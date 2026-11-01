// keycloak-theme-mco – account console
//
// Replaces the React console of keycloak.v3 with a small page in the style of the login theme.
// Signs in against the public "account-console" client (authorization code + PKCE, the server
// session from the login makes this a silent redirect) and talks to the Account REST API.
// Tokens are kept in memory only; sessionStorage only holds PKCE state across the redirect.

const app = document.getElementById("kc-account");
const cfg = app.dataset;
const messages = readJson("kc-account-messages");

const accountUrl = cfg.baseUrl; // ends with "/"
const oidcUrl = `${cfg.serverBaseUrl}/realms/${encodeURIComponent(cfg.realm)}/protocol/openid-connect`;
const ROOT_FIELDS = ["username", "email", "firstName", "lastName"];
const PKCE_KEY = "kc-account-pkce";
const FLASH_KEY = "kc-account-flash";
const ROUTES = { "": "home", home: "home", profile: "profile", logout: "logout" };

let tokens = null; // { access, refresh, id, expiresAt }
let user = null;   // Account REST representation incl. userProfileMetadata

// --- Helpers ---------------------------------------------------------------------------------------
function readJson(id) {
  try {
    return JSON.parse(document.getElementById(id)?.textContent || "{}");
  } catch {
    return {};
  }
}

// Messages come from msgJSON: "{0}" placeholders are converted to "{{param_0}}"
function t(key, ...params) {
  let text = messages[key] ?? key;
  params.forEach((p, i) => { text = text.replaceAll(`{{param_${i}}}`, p); });
  return text;
}

// User profile labels may reference messages: "${firstName}"
function label(text) {
  const match = /^\$\{(.+)\}$/.exec(text ?? "");
  return match ? t(match[1]) : (text ?? "");
}

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function take(key) {
  const store = storage();
  try {
    const value = store?.getItem(key);
    store?.removeItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function put(key, value) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (name === "class") node.className = value;
    else if (name === "text") node.textContent = value;
    else node.setAttribute(name, value === true ? "" : value);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(bytes = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  } catch {
    return {};
  }
}

// --- Alerts (same markup as the login theme) ------------------------------------------------------
const ALERT_ICONS = { success: "check-circle", error: "exclamation-circle", warning: "exclamation-triangle", info: "info-circle" };

function showAlert(type, text) {
  const box = document.getElementById("kc-account-alert");
  box.replaceChildren(el("div", { class: `kc-alert alert-${type}`, role: type === "error" ? "alert" : "status" },
    el("span", { class: `bi bi-${ALERT_ICONS[type]}`, "aria-hidden": "true" }),
    el("span", { class: "kc-alert__text", text })));
}

function clearAlert() {
  document.getElementById("kc-account-alert").replaceChildren();
}

// --- OIDC: authorization code + PKCE --------------------------------------------------------------
async function redirectToLogin(action) {
  const verifier = randomString(48);
  const state = randomString();
  const nonce = randomString();
  const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));

  if (!put(PKCE_KEY, { verifier, state, nonce, action, route: location.hash || "#/" })) {
    showAlert("error", t("kcAccountSignInFailed"));
    return;
  }

  const scope = [...new Set(["openid", ...(cfg.scope || "").split(" ")])].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: accountUrl,
    response_type: "code",
    response_mode: "query",
    scope,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ui_locales: cfg.uiLocale,
  });
  if (action) params.set("kc_action", action);
  location.assign(`${oidcUrl}/auth?${params}`);
}

function storeTokens(data) {
  tokens = {
    access: data.access_token,
    refresh: data.refresh_token,
    id: data.id_token ?? tokens?.id,
    expiresAt: Date.now() + (data.expires_in ?? 60) * 1000,
  };
}

async function tokenRequest(params) {
  const res = await fetch(`${oidcUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, ...params }),
  });
  if (!res.ok) throw new Error(`token endpoint: ${res.status}`);
  return res.json();
}

// Returns true when signed in, false when a redirect to the login is under way
async function signIn() {
  const query = new URLSearchParams(location.search);
  if (!query.has("state")) {
    await redirectToLogin();
    return false;
  }

  const saved = take(PKCE_KEY);
  history.replaceState(null, "", accountUrl + (saved?.route || "#/"));

  // No retry on errors: a failing callback must not end up in a redirect loop
  if (!saved || saved.state !== query.get("state") || !query.has("code")) {
    throw new Error(query.get("error_description") || query.get("error") || "invalid callback");
  }

  const data = await tokenRequest({
    grant_type: "authorization_code",
    code: query.get("code"),
    redirect_uri: accountUrl,
    code_verifier: saved.verifier,
  });
  if (data.id_token && decodeJwt(data.id_token).nonce !== saved.nonce) {
    throw new Error("invalid nonce");
  }
  storeTokens(data);

  const status = query.get("kc_action_status");
  if (saved.action && status === "success") showAlert("success", t(`kcAccountAction${saved.action}`));
  else if (saved.action && status === "cancelled") showAlert("info", t("kcAccountActionCancelled"));
  else if (saved.action && status === "error") showAlert("error", t("kcAccountError"));
  return true;
}

async function accessToken() {
  if (tokens.expiresAt - 10_000 < Date.now()) {
    try {
      storeTokens(await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh }));
    } catch {
      await redirectToLogin();
      throw new Error("session expired");
    }
  }
  return tokens.access;
}

function logout() {
  const params = new URLSearchParams({ client_id: cfg.clientId, post_logout_redirect_uri: accountUrl });
  if (tokens?.id) params.set("id_token_hint", tokens.id);
  location.assign(`${oidcUrl}/logout?${params}`);
}

// --- Account REST API -----------------------------------------------------------------------------
// The account endpoint serves the REST API only for "Accept: application/json"
async function api(path = "", options = {}) {
  const res = await fetch(accountUrl + path, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${await accessToken()}`,
    },
  });
  if (res.status === 401) {
    await redirectToLogin();
    throw new Error("unauthorized");
  }
  return res;
}

async function fetchUser() {
  const res = await api("?userProfileMetadata=true");
  if (!res.ok) throw new Error(`account: ${res.status}`);
  return res.json();
}

async function saveUser(rep) {
  const body = { ...rep };
  delete body.userProfileMetadata;
  return api("", { method: "POST", body: JSON.stringify(body) });
}

function errorText(error) {
  return t(error.errorMessage ?? "kcAccountError", ...(error.params ?? []).map((p) => label(String(p))));
}

// --- Profile form -----------------------------------------------------------------------------------
function attributeValues(name) {
  if (ROOT_FIELDS.includes(name)) return user[name] != null ? [user[name]] : [];
  const value = user.attributes?.[name];
  return Array.isArray(value) ? value : value != null ? [value] : [];
}

function optionLabel(attr, option) {
  const annotations = attr.annotations ?? {};
  if (annotations.inputOptionLabels?.[option]) return label(annotations.inputOptionLabels[option]);
  if (annotations.inputOptionLabelsI18nPrefix) return t(`${annotations.inputOptionLabelsI18nPrefix}.${option}`);
  return option;
}

function buildSelect(id, name, options, values, { multiple, disabled, required, labelFor }) {
  const select = el("select", { class: "form-control", id, name, multiple, disabled, required, "aria-describedby": `${id}-error` });
  if (!multiple) select.append(el("option", { value: "", text: t("kcAccountSelectOption") }));
  for (const option of options) {
    select.append(el("option", { value: option, text: labelFor(option), selected: values.includes(option) }));
  }
  return select;
}

function buildField(attr) {
  const annotations = attr.annotations ?? {};
  const id = `kc-field-${attr.name}`;
  const values = attributeValues(attr.name);
  const options = attr.validators?.options?.options;
  const updateEmail = attr.name === "email" && cfg.updateEmail === "true";
  const readOnly = attr.readOnly || updateEmail;
  let type = annotations.inputType ?? (options ? "select" : attr.name === "email" ? "html5-email" : "text");

  let input;
  if (options && /select|radio|checkbox/.test(type)) {
    const multiple = attr.multivalued || type.startsWith("multiselect");
    input = buildSelect(id, attr.name, options, values, {
      multiple, disabled: readOnly, required: attr.required, labelFor: (o) => optionLabel(attr, o),
    });
  } else if (type === "textarea") {
    input = el("textarea", { class: "form-control", id, name: attr.name, readonly: readOnly, required: attr.required, rows: annotations.inputTypeRows });
    input.value = values[0] ?? "";
  } else {
    type = type.startsWith("html5-") ? type.slice(6) : "text";
    input = el("input", {
      class: "form-control", id, name: attr.name, type, readonly: readOnly, required: attr.required,
      placeholder: annotations.inputTypePlaceholder ? label(annotations.inputTypePlaceholder) : null,
      autocomplete: { email: "email", firstName: "given-name", lastName: "family-name", username: "username" }[attr.name] ?? null,
    });
    input.value = values[0] ?? "";
  }
  input.setAttribute("aria-describedby", `${id}-error`);
  input.dataset.attribute = attr.name;

  return el("div", { class: "kc-form-group", id: `${id}-group` },
    el("div", { class: "kc-label-wrapper" },
      el("label", { class: "form-label", for: id }, label(attr.displayName) || attr.name,
        attr.required ? el("span", { class: "required", text: " *" }) : null)),
    el("div", { class: "kc-input-wrapper" },
      annotations.inputHelperTextBefore ? el("div", { class: "form-text kc-helper-text-before", text: label(annotations.inputHelperTextBefore) }) : null,
      input,
      el("span", { class: "kc-input-error", id: `${id}-error`, "aria-live": "polite", hidden: true }),
      annotations.inputHelperTextAfter ? el("div", { class: "form-text kc-helper-text-after", text: label(annotations.inputHelperTextAfter) }) : null,
      updateEmail ? el("button", { type: "button", class: "btn btn-secondary kc-field-action", "data-action": "UPDATE_EMAIL", text: t("kcAccountUpdateEmail") }) : null));
}

function localeOptions() {
  return [...document.querySelectorAll("#kc-account-locales [data-locale]")]
    .map((b) => ({ code: b.dataset.locale, label: b.textContent.trim() }));
}

function renderProfile() {
  const container = document.getElementById("kc-account-profile-fields");
  const meta = user.userProfileMetadata ?? { attributes: [], groups: [] };
  const groups = Object.fromEntries((meta.groups ?? []).map((g) => [g.name, g]));
  const nodes = [];
  let currentGroup;

  for (const attr of meta.attributes ?? []) {
    if (attr.name === "locale") continue; // rendered below as language selection
    if (attr.group && attr.group !== currentGroup && groups[attr.group]) {
      const group = groups[attr.group];
      nodes.push(el("div", { class: "kc-form-group-header", text: label(group.displayHeader) || group.name }));
      if (group.displayDescription) nodes.push(el("p", { class: "form-text", text: label(group.displayDescription) }));
    }
    currentGroup = attr.group;
    nodes.push(buildField(attr));
  }

  const locales = localeOptions();
  if (locales.length > 1) {
    const current = attributeValues("locale")[0] ?? cfg.uiLocale;
    const names = Object.fromEntries(locales.map((l) => [l.code, l.label]));
    nodes.push(el("div", { class: "kc-form-group" },
      el("label", { class: "form-label", for: "kc-field-locale", text: t("kcAccountLanguage") }),
      buildSelect("kc-field-locale", "locale", locales.map((l) => l.code), [current], { labelFor: (c) => names[c] })));
  }

  container.replaceChildren(...nodes);
}

function formToUser(form) {
  const rep = { ...user, attributes: { ...(user.attributes ?? {}) } };
  for (const field of form.querySelectorAll("[name]")) {
    if (field.disabled || field.readOnly) continue;
    const values = field.multiple ? [...field.selectedOptions].map((o) => o.value) : [field.value.trim()];
    if (ROOT_FIELDS.includes(field.name)) rep[field.name] = values[0] ?? "";
    else rep.attributes[field.name] = values.filter((v) => v !== "");
  }
  return rep;
}

function clearFieldErrors(form) {
  form.querySelectorAll(".kc-input-error").forEach((e) => { e.hidden = true; e.textContent = ""; });
  form.querySelectorAll("[aria-invalid]").forEach((f) => f.removeAttribute("aria-invalid"));
}

async function onProfileSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = document.getElementById("kc-account-profile-save");
  clearAlert();
  clearFieldErrors(form);
  button.disabled = true;

  try {
    const rep = formToUser(form);
    const res = await saveUser(rep);
    if (res.ok) {
      const oldLocale = attributeValues("locale")[0] ?? cfg.uiLocale;
      const newLocale = rep.attributes.locale?.[0];
      if (newLocale && newLocale !== oldLocale) {
        put(FLASH_KEY, "kcAccountSaved");
        location.reload();
        return;
      }
      user = await fetchUser();
      renderProfile();
      updateWelcome();
      showAlert("success", t("kcAccountSaved"));
      return;
    }

    const body = await res.json().catch(() => ({}));
    const errors = body.errors ?? [body];
    const general = [];
    for (const error of errors) {
      const field = error.field && form.querySelector(`[name="${CSS.escape(error.field)}"]`);
      const box = field && document.getElementById(`${field.id}-error`);
      if (box) {
        field.setAttribute("aria-invalid", "true");
        box.textContent = errorText(error);
        box.hidden = false;
      } else {
        general.push(errorText(error));
      }
    }
    if (general.length) showAlert("error", general.join(" "));
    form.querySelector("[aria-invalid]")?.focus();
  } catch (error) {
    console.error(error);
    showAlert("error", t("kcAccountError"));
  } finally {
    button.disabled = false;
  }
}

// Language switch in the navbar: stored as the user's locale, then reload in that language
async function switchLocale(code) {
  try {
    const current = user ?? await fetchUser();
    const res = await saveUser({ ...current, attributes: { ...(current.attributes ?? {}), locale: [code] } });
    if (!res.ok) throw new Error(`account: ${res.status}`);
    location.reload();
  } catch (error) {
    console.error(error);
    showAlert("error", t("kcAccountError"));
  }
}

function updateWelcome() {
  const name = user?.firstName || user?.username;
  if (name) document.getElementById("kc-account-welcome").textContent = t("kcAccountWelcomeName", name);
}

// --- Navigation -------------------------------------------------------------------------------------
function currentRoute() {
  const name = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return ROUTES[name] ?? "home";
}

// Deep links of the default console (/account/personal-info, /account/account-security/...)
function legacyRoute() {
  const path = location.pathname.slice(new URL(accountUrl, location.href).pathname.length);
  return /^(personal-info|account-security)/.test(path) ? "#/profile" : "";
}

async function render() {
  const route = currentRoute();
  document.querySelectorAll(".kc-view").forEach((view) => { view.hidden = view.dataset.view !== route; });
  document.querySelectorAll("[data-route]").forEach((link) => {
    const active = link.dataset.route === route;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  toggleNav(false);

  if (route === "profile") {
    try {
      user = await fetchUser();
      renderProfile();
    } catch (error) {
      console.error(error);
      showAlert("error", t("kcAccountError"));
    }
  }
}

function toggleNav(open) {
  const toggle = document.getElementById("kc-account-nav-toggle");
  const nav = document.getElementById("kc-account-nav");
  const value = open ?? toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(value));
  nav.classList.toggle("is-open", value);
}

function initDropdown() {
  const toggle = document.getElementById("kc-current-locale-link");
  const menu = document.getElementById("kc-account-locales");
  if (!toggle || !menu) return;
  const items = () => [...menu.querySelectorAll("[role=menuitem]")];

  const setOpen = (open, focusFirst = false) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.style.display = open ? "block" : "";
    if (open && focusFirst) (menu.querySelector(".is-active") ?? items()[0])?.focus();
  };

  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  toggle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true, true); }
  });
  menu.addEventListener("keydown", (e) => {
    const list = items();
    const index = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); list[(index + 1) % list.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); list[(index - 1 + list.length) % list.length].focus(); }
    if (e.key === "Escape") { setOpen(false); toggle.focus(); }
  });
  menu.addEventListener("click", (e) => {
    const item = e.target.closest("[data-locale]");
    if (!item) return;
    setOpen(false);
    if (!item.classList.contains("is-active")) switchLocale(item.dataset.locale);
  });
  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) setOpen(false);
  });
}

// --- Start ------------------------------------------------------------------------------------------
async function start() {
  document.getElementById("kc-account-nav-toggle").addEventListener("click", () => toggleNav());
  document.getElementById("kc-account-profile-form").addEventListener("submit", onProfileSubmit);
  document.getElementById("kc-account-logout").addEventListener("click", logout);
  document.addEventListener("click", (e) => {
    const button = e.target.closest("[data-action]");
    if (button) redirectToLogin(button.dataset.action);
  });
  initDropdown();

  if (!location.hash && !location.search) {
    const legacy = legacyRoute();
    if (legacy) history.replaceState(null, "", accountUrl + legacy);
  }

  try {
    if (!(await signIn())) return;
  } catch (error) {
    console.error(error);
    document.getElementById("kc-account-loading").hidden = true;
    showAlert("error", t("kcAccountSignInFailed"));
    return;
  }

  const flash = take(FLASH_KEY);
  if (flash) showAlert("success", t(flash));

  document.getElementById("kc-account-loading").hidden = true;
  window.addEventListener("hashchange", () => { clearAlert(); render(); });
  await render();

  if (!user) {
    try { user = await fetchUser(); } catch (error) { console.error(error); }
  }
  updateWelcome();
}

start();
