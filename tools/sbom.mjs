// Turns the SBOM produced by `npm sbom` into an SBOM of the theme JAR.
//
// `npm sbom` only knows package.json: the root component carries the static
// package.json version, every npm package is a dev dependency, and the
// self-hosted font (downloaded from Fontsource, not via npm) is missing.
// This script sets the root component to the built JAR (name, version, license,
// MD5/SHA-256), marks the npm packages whose files end up in the JAR as shipped
// and adds the font. Everything else stays a build-only dependency.
//
// Usage:
//   node tools/sbom.mjs cyclonedx <npm-sbom.json> <jar> <name> <version> <font-family> <font-version>
//   node tools/sbom.mjs spdx      <npm-sbom.json> <jar> <name> <version> <font-family> <font-version>
//   node tools/sbom.mjs licenses  <sbom.cdx.json>       -> license report on stdout

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// npm packages whose files are part of the JAR (compiled CSS, icon SVGs)
const SHIPPED = ["bootstrap", "bootstrap-icons"];
const LICENSE = "Apache-2.0";
const FONT_LICENSE = "OFL-1.1";

const [format, input, jar, name, version, fontFamily, fontVersion] = process.argv.slice(2);

let raw = readFileSync(input, "utf8");
if (format !== "licenses") {
    // npm uses the package.json version in refs/ids; replace it with the build version
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    raw = raw
        .replaceAll(`${pkg.name}@${pkg.version}`, `${name}@${version}`)
        .replaceAll(`${pkg.name}-${pkg.version}`, `${name}-${version}`);
}
const sbom = JSON.parse(raw);

const isShipped = (n) => SHIPPED.includes(n);
const hash = (alg) => createHash(alg).update(readFileSync(jar)).digest("hex");
const font = {
    name: `@fontsource/${fontFamily}`,
    version: fontVersion,
    purl: `pkg:npm/%40fontsource/${fontFamily}@${fontVersion}`,
    description: `Self-hosted web font (woff2), downloaded from the Fontsource CDN`,
};

switch (format) {
    case "cyclonedx": cyclonedx(); break;
    case "spdx": spdx(); break;
    case "licenses": licenses(); break;
    default:
        console.error(`unknown format: ${format}`);
        process.exit(2);
}

function cyclonedx() {
    const root = sbom.metadata.component;
    Object.assign(root, {
        type: "application",
        name,
        version,
        licenses: [{ license: { id: LICENSE } }],
        hashes: [
            { alg: "MD5", content: hash("md5") },
            { alg: "SHA-256", content: hash("sha256") },
        ],
        properties: [{ name: "cdx:file:name", value: basename(jar) }],
    });
    sbom.metadata.lifecycles = [{ phase: "build" }];

    for (const c of sbom.components) {
        if (isShipped(c.name)) {
            c.scope = "required";
            c.properties = (c.properties ?? []).filter((p) => p.name !== "cdx:npm:package:development");
        }
    }

    const fontRef = `${font.name}@${font.version}`;
    sbom.components.push({
        "bom-ref": fontRef,
        type: "library",
        name: font.name,
        version: font.version,
        scope: "required",
        description: font.description,
        licenses: [{ license: { id: FONT_LICENSE } }],
        purl: font.purl,
    });
    sbom.dependencies.push({ ref: fontRef, dependsOn: [] });
    sbom.dependencies.find((d) => d.ref === root["bom-ref"]).dependsOn.push(fontRef);

    console.log(JSON.stringify(sbom, null, 2));
}

function spdx() {
    const rootId = sbom.documentDescribes[0];
    const root = sbom.packages.find((p) => p.SPDXID === rootId);
    Object.assign(root, {
        packageFileName: basename(jar),
        primaryPackagePurpose: "APPLICATION",
        licenseDeclared: LICENSE,
        licenseConcluded: LICENSE,
        checksums: [
            { algorithm: "MD5", checksumValue: hash("md5") },
            { algorithm: "SHA256", checksumValue: hash("sha256") },
        ],
    });

    const shippedIds = new Set(sbom.packages.filter((p) => isShipped(p.name)).map((p) => p.SPDXID));
    for (const r of sbom.relationships) {
        if (shippedIds.has(r.spdxElementId) && r.relatedSpdxElement === rootId) {
            r.relationshipType = "CONTAINED_BY";
        }
    }

    const fontId = `SPDXRef-Package-${font.name.replace(/[^A-Za-z0-9.-]/g, "-")}-${font.version}`;
    sbom.packages.push({
        name: font.name,
        SPDXID: fontId,
        versionInfo: font.version,
        packageFileName: "",
        description: font.description,
        primaryPackagePurpose: "LIBRARY",
        downloadLocation: `https://cdn.jsdelivr.net/fontsource/fonts/${fontFamily}@${fontVersion}`,
        filesAnalyzed: false,
        homepage: `https://fontsource.org/fonts/${fontFamily}`,
        licenseDeclared: FONT_LICENSE,
        externalRefs: [{ referenceCategory: "PACKAGE-MANAGER", referenceType: "purl", referenceLocator: font.purl }],
    });
    sbom.relationships.push({ spdxElementId: fontId, relatedSpdxElement: rootId, relationshipType: "CONTAINED_BY" });

    console.log(JSON.stringify(sbom, null, 2));
}

function licenses() {
    const rows = sbom.components.map((c) => [
        c.name,
        c.version,
        (c.licenses ?? []).map((l) => l.license?.id ?? l.license?.name ?? l.expression).join(" OR ") || "UNKNOWN",
        c.scope === "required" ? "shipped" : "build only",
    ]);
    rows.sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0]));
    const header = ["Component", "Version", "License", "Usage"];
    const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const line = (r) => r.map((v, i) => v.padEnd(widths[i])).join("  ").trimEnd();
    const root = sbom.metadata.component;
    console.log(`Licenses for ${root.name} ${root.version} (${root.licenses[0].license.id})\n`);
    console.log([line(header), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n"));
}
