# keycloak-theme-mco

Keycloak login theme for Keycloak **26.1.4** and later (`parent=base`, no PatternFly).

## Requirements

To build and package the theme using `make`, you will need the following toolchain:

* `node`
* `npm`
* `curl`
* ImageMagick (`convert`)
* `zip`
* docker + docker compose (for `make dev`)
* java 11+ (for `make lint`)

```sh
make            # -> dist/keycloak-theme-mco-1.0.0.jar
make theme      # only build build/theme/keycloak-theme-mco/
make dev        # Keycloak 26.1.4 via Docker Compose with the theme mounted (http://localhost:8080, admin/admin)
make watch      # recompile SCSS on change
make lint       # FreeMarker syntax check of all .ftl templates
make clean      # delete build/ and dist/
make distclean  # additionally delete node_modules/ and .cache/
```

## Installation

Copy the JAR to `/opt/keycloak/providers/` (in production run `kc.sh build` afterwards),
then select `keycloak-theme-mco` in the admin console under *Realm settings → Themes → Login theme*.

## Release

Pushing a version tag triggers `.github/workflows/release.yml`: it runs `make lint` (the workflow
stops on any template error), builds the JAR with the version taken from the tag and publishes it
as a GitHub release with generated notes.

```sh
git tag v1.0.0
git push origin v1.0.0    # -> release v1.0.0 with keycloak-theme-mco-1.0.0.jar
```

## Development

### `make dev`

Builds the unpacked theme (`make theme`: templates, CSS, fonts, icons, images) and then starts
Keycloak in the foreground with `docker compose up`. The container

- uses `quay.io/keycloak/keycloak:26.1.4` (override with `make dev KC_VERSION=<version>`),
- runs `start-dev` with an in-container H2 database – all data is lost on `docker compose down`,
- creates the admin user `admin` / `admin`,
- mounts `build/theme/keycloak-theme-mco` read-only to `/opt/keycloak/themes/keycloak-theme-mco`,
- disables theme, template and static resource caching, so changes under `build/theme/` are
  served on the next page load without restarting.

First run:

1. `make dev` and wait for `Keycloak 26.1.4 ... started`.
2. Open the admin console at <http://localhost:8080/admin> and log in with `admin` / `admin`.
3. *Realm settings → Themes → Login theme* → `keycloak-theme-mco` → *Save*
   (for a test realm of your own, do the same there).
4. Open <http://localhost:8080/realms/master/account> in a private window to see the login page.
   To test other pages (registration, forgot password, OTP, …), enable the corresponding options
   under *Realm settings → Login* or *Authentication*.

Stop with `Ctrl+C`; `docker compose down` removes the container (and its data).

### `make watch`

Runs Sass in watch mode: every change below `src/scss/` recompiles
`build/theme/keycloak-theme-mco/login/resources/css/login.css`, which the running container picks up directly.
It only handles SCSS. Recommended workflow with two terminals:

```sh
make dev        # terminal 1: Keycloak
make watch      # terminal 2: SCSS
```

- **SCSS** (`src/scss/`): saved → compiled by `make watch` → reload the browser.
- **Templates, `theme.properties`, messages** (`src/theme/`): not watched – run `make theme`,
  then reload the browser.
- **`ICONS` in the Makefile**: run `make theme` (copies the SVGs and regenerates the icon classes);
  restart `make watch` so it compiles against the new icon list.
- After `make clean` the mounted directory is gone: run `make theme` and restart `make dev`.

If a change does not show up, force-reload the page (`Ctrl+Shift+R`).

## Linting

`make lint` parses every `.ftl` file under `src/theme/` with FreeMarker **2.3.32** – the version
bundled with Keycloak 26.1.4 – using HTML auto-escaping like Keycloak does (`tools/FtlLint.java`).
The FreeMarker JAR is downloaded from Maven Central into `.cache/` on first use.
It reports syntax errors as `file:line:column: message` and exits non-zero; it does not render the
templates, so runtime errors (missing variables, wrong types) only show up in Keycloak itself.

## Structure

| Path                                                  | Content                                                                    |
|-------------------------------------------------------|----------------------------------------------------------------------------|
| `src/theme/keycloak-theme-mco/login/template.ftl`     | Page skeleton: navbar, image + form, footer                                |
| `src/theme/keycloak-theme-mco/login/theme.properties` | Class mapping of the base templates, page image and title icon per page    |
| `src/theme/keycloak-theme-mco/login/messages/`        | Additional texts (de, en; other languages fall back to en)                 |
| `src/scss/`                                           | Styles; `_bootstrap.scss` lists the included Bootstrap parts               |
| `tools/FtlLint.java`                                  | FreeMarker syntax checker used by `make lint`                              |
| `Makefile`                                            | `ICONS` = the single list of shipped Bootstrap Icons, font weights/subsets |

Page image/icon per page: `heroImage-<template>` or `pageIcon-<template>` in `theme.properties`
(`<template>` = file name without `.ftl`, e.g. `login-otp`).

## Adding icons

Only the Bootstrap Icons listed in `ICONS` in the `Makefile` are shipped. Each one is copied as
`login/resources/img/icons/<name>.svg` and gets a CSS class `bi-<name>` (rendered as a CSS mask,
so it takes the current text color).

1. Find the icon name:
   - Search: <https://icons.getbootstrap.com/>
   - Single icon page: `https://icons.getbootstrap.com/icons/<name>/`,
     e.g. <https://icons.getbootstrap.com/icons/shield-lock/>
   - Source SVGs of the pinned version (1.13.2):
     <https://github.com/twbs/icons/tree/v1.13.2/icons>
   - The website always shows the latest release; check that the icon exists in the installed
     version: `ls node_modules/bootstrap-icons/icons/<name>.svg`
2. Add the name (without `.svg`) to `ICONS` in the `Makefile`.
3. Use it:
   - in templates: `<i class="bi bi-<name>" aria-hidden="true"></i>`
   - as a page title icon: `pageIcon-<template>=<name>` in `theme.properties`
   - for Keycloak icon properties (`kcLogoIdP-<alias>`, `kcAuthenticator*Class`, `kcWebAuthn*`, …):
     `bi bi-<name>`. Available property keys are defined in the base theme:
     <https://github.com/keycloak/keycloak/blob/26.1.4/themes/src/main/resources/theme/base/login/theme.properties>
4. Run `make theme` (or `make`), and restart `make watch` if it is running.

To remove an icon, delete it from `ICONS` and run `make clean theme`, so the old SVG is not
left behind in `build/`.
