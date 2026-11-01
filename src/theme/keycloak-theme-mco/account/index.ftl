<#--
  Account console of keycloak-theme-mco.
  Rendered by Keycloak's AccountConsole (only for signed-in users) instead of the React console of
  keycloak.v3. The page skeleton matches login/template.ftl; js/account.js signs in against the
  public "account-console" client (authorization code + PKCE) and uses the Account REST API.
-->
<#-- /resources/<version>/account/<theme> -> /resources/<version>/common/keycloak-theme-mco -->
<#assign sharedPath = resourceUrl?keep_before_last("/account/") + "/" + properties.sharedResources>
<#assign realmName = realm.displayName!realm.name>
<#assign showLocales = realm.internationalizationEnabled && supportedLocales?size gt 1>
<#assign brandUrl = referrer_uri!baseUrl>
<!DOCTYPE html>
<html class="kc-html" lang="${locale}">

<head>
    <meta charset="utf-8">
    <meta name="robots" content="noindex, nofollow">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${msg("kcAccountTitle", realmName)}</title>
    <link rel="icon" href="${sharedPath}/img/favicon.ico" />
    <link rel="preload" href="${sharedPath}/fonts/source-sans-pro-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${sharedPath}/fonts/source-sans-pro-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
    <#list (properties.sharedStyles!"")?split(' ') as style>
        <#if style?has_content><link href="${sharedPath}/${style}" rel="stylesheet" /></#if>
    </#list>
    <#if !isSecureContext>
        <#-- crypto.subtle (PKCE) is only available in secure contexts -->
        <script type="module" src="${resourceCommonUrl}/vendor/web-crypto-shim/web-crypto-shim.js"></script>
    </#if>
    <#list (properties.sharedScripts!"")?split(' ') as script>
        <#if script?has_content><script type="module" src="${sharedPath}/${script}"></script></#if>
    </#list>
</head>

<body class="kc-body" data-page="account">
<div id="kc-account" class="kc-app"
     data-server-base-url="${serverBaseUrl}"
     data-realm="${realm.name}"
     data-client-id="${clientId}"
     data-base-url="${baseUrl}"
     data-ui-locale="${locale}"
     data-scope="${scope!""}"
     data-update-email="${(updateEmailFeatureEnabled && updateEmailActionEnabled)?c}">

    <header id="kc-header" class="kc-navbar">
        <div class="kc-navbar__inner">
            <a class="kc-brand" href="${brandUrl}"<#if referrerName??> title="${msg("kcAccountBackTo", referrerName)}"</#if>>
                <img class="kc-brand__logo" src="${sharedPath}/img/logo.png" alt="${realmName}" width="32" height="32">
            </a>

            <button class="kc-navbar__toggle" id="kc-account-nav-toggle" type="button" aria-controls="kc-account-nav" aria-expanded="false" aria-label="${msg("kcAccountMenu")}">
                <i class="bi bi-list" aria-hidden="true"></i>
            </button>

            <nav id="kc-account-nav" class="kc-nav kc-nav--collapse" aria-label="${msg("kcAccountNavigation")}">
                <#if referrer_uri?? && referrerName??>
                    <a class="kc-nav__link" href="${referrer_uri}">${msg("kcAccountBackTo", referrerName)}</a>
                </#if>
                <a class="kc-nav__link" href="#/" data-route="home">${msg("kcAccountHome")}</a>
                <a class="kc-nav__link" href="#/profile" data-route="profile">${msg("kcAccountProfile")}</a>
                <a class="kc-nav__link" href="#/logout" data-route="logout">${msg("kcAccountLogout")}</a>
                <#if showLocales>
                    <div class="kc-locale">
                        <div class="kc-dropdown" id="kc-locale-dropdown">
                            <button type="button" id="kc-current-locale-link" class="kc-nav__link kc-dropdown__toggle" aria-label="${msg("kcAccountLanguages")}" aria-haspopup="true" aria-expanded="false" aria-controls="kc-account-locales">
                                <i class="bi bi-globe" aria-hidden="true"></i>
                                <span>${supportedLocales[locale]!locale}</span>
                                <i class="bi bi-chevron-down kc-dropdown__caret" aria-hidden="true"></i>
                            </button>
                            <ul role="menu" tabindex="-1" aria-labelledby="kc-current-locale-link" id="kc-account-locales" class="kc-dropdown__menu">
                                <#list supportedLocales as code, label>
                                    <li class="kc-dropdown__item" role="none">
                                        <button type="button" role="menuitem" class="kc-dropdown__link<#if code == locale> is-active</#if>" data-locale="${code}" lang="${code}">${label}</button>
                                    </li>
                                </#list>
                            </ul>
                        </div>
                    </div>
                </#if>
            </nav>
        </div>
    </header>

    <main class="kc-main">
        <div class="container">
            <div id="kc-account-alert" class="kc-account-alert" aria-live="polite"></div>

            <div id="kc-account-loading" class="kc-account-loading" role="status">
                <span class="kc-spinner" aria-hidden="true"></span>
                <span>${msg("kcAccountLoading")}</span>
            </div>
            <noscript>
                <div class="kc-alert alert-warning"><span class="bi bi-exclamation-triangle" aria-hidden="true"></span><span class="kc-alert__text">${msg("kcAccountNoScript")}</span></div>
            </noscript>

            <#-- Home ---------------------------------------------------------------------------- -->
            <section class="kc-view" data-view="home" aria-labelledby="kc-account-welcome" hidden>
                <div class="kc-layout">
                    <#if properties["heroImage-home"]?has_content>
                        <div class="kc-hero" aria-hidden="true">
                            <img src="${sharedPath}/${properties["heroImage-home"]}" alt="" width="800" height="800">
                        </div>
                    </#if>
                    <div class="kc-card">
                        <header class="kc-page-header">
                            <h1 class="kc-title"><span class="kc-title__text" id="kc-account-welcome">${msg("kcAccountWelcome")}</span></h1>
                            <p class="kc-subtitle">${msg("kcAccountIntro", realmName)}</p>
                        </header>
                        <div class="kc-form-buttons">
                            <a class="btn btn-primary kc-btn-icon" href="#/profile">
                                <span>${msg("kcAccountToProfile")}</span>
                                <i class="bi bi-arrow-right" aria-hidden="true"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <#-- Profile + password ----------------------------------------------------------------- -->
            <section class="kc-view" data-view="profile" aria-labelledby="kc-account-profile-title" hidden>
                <div class="kc-account-grid">
                    <section class="kc-account-section" aria-labelledby="kc-account-profile-title">
                        <header class="kc-page-header">
                            <h1 class="kc-title kc-title--accent" id="kc-account-profile-title">
                                <i class="bi bi-person kc-title__icon" aria-hidden="true"></i>
                                <span class="kc-title__text">${msg("kcAccountProfile")}</span>
                            </h1>
                        </header>
                        <form id="kc-account-profile-form" class="kc-panel kc-form" novalidate>
                            <div class="kc-panel__body">
                                <p class="kc-required-hint"><span class="required">*</span> ${msg("kcAccountRequiredFields")}</p>
                                <div id="kc-account-profile-fields"></div>
                            </div>
                            <div class="kc-panel__footer">
                                <button type="submit" class="btn btn-primary" id="kc-account-profile-save">${msg("kcAccountSave")}</button>
                            </div>
                        </form>
                    </section>

                    <section class="kc-account-section" aria-labelledby="kc-account-password-title">
                        <header class="kc-page-header">
                            <h2 class="kc-title kc-title--accent" id="kc-account-password-title">
                                <i class="bi bi-shield-lock kc-title__icon" aria-hidden="true"></i>
                                <span class="kc-title__text">${msg("kcAccountPassword")}</span>
                            </h2>
                        </header>
                        <div class="kc-panel">
                            <div class="kc-panel__body">
                                <p>${msg("kcAccountPasswordInfo")}</p>
                            </div>
                            <div class="kc-panel__footer">
                                <button type="button" class="btn btn-primary" data-action="UPDATE_PASSWORD">${msg("kcAccountPasswordChange")}</button>
                            </div>
                        </div>
                    </section>
                </div>
            </section>

            <#-- Logout confirmation ----------------------------------------------------------------- -->
            <section class="kc-view" data-view="logout" aria-labelledby="kc-account-logout-title" hidden>
                <div class="kc-layout">
                    <#if properties["heroImage-logout"]?has_content>
                        <div class="kc-hero" aria-hidden="true">
                            <img src="${sharedPath}/${properties["heroImage-logout"]}" alt="" width="800" height="800">
                        </div>
                    </#if>
                    <div class="kc-card">
                        <header class="kc-page-header">
                            <h1 class="kc-title" id="kc-account-logout-title"><span class="kc-title__text">${msg("kcAccountLogoutTitle")}</span></h1>
                            <p class="kc-subtitle">${msg("kcAccountLogoutSubtitle")}</p>
                        </header>
                        <p class="instruction">${msg("kcAccountLogoutQuestion")}</p>
                        <div class="kc-form-buttons">
                            <button type="button" class="btn btn-primary" id="kc-account-logout">${msg("kcAccountLogoutConfirm")}</button>
                            <a class="btn btn-secondary" href="#/">${msg("kcAccountCancel")}</a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </main>

    <footer class="kc-footer">
        <div class="container">
            <span class="kc-footer__brand"><strong>${realmName}</strong> ${msg("kcAccountFooter")}</span>
        </div>
    </footer>
</div>
<script type="application/json" id="kc-account-messages">${msgJSON?replace("</", "<\\/")?no_esc}</script>
</body>
</html>
