<#import "footer.ftl" as loginFooter>
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#assign kcPage = (.main_template_name!"")?remove_ending(".ftl")>
<#assign heroImage = properties["heroImage-" + kcPage]!properties.heroImage!"">
<#assign pageIcon = properties["pageIcon-" + kcPage]!properties.pageIcon!"shield-lock">
<#assign clientLogo = (client.attributes.logoUri)!"">
<#assign showLocales = realm.internationalizationEnabled && locale.supported?size gt 1>
<#assign appUrl = (client.baseUrl)!"">
<#-- /resources/<version>/login/<theme> -> /resources/<version>/common/keycloak-theme-mco -->
<#assign sharedPath = url.resourcesPath?keep_before_last("/login/") + "/" + properties.sharedResources>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}" lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="robots" content="noindex, nofollow">

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    <link rel="icon" href="${sharedPath}/img/favicon.ico" />
    <link rel="preload" href="${sharedPath}/fonts/source-sans-pro-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${sharedPath}/fonts/source-sans-pro-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.sharedStyles?has_content>
        <#list properties.sharedStyles?split(' ') as style>
            <link href="${sharedPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <script src="${url.resourcesPath}/js/menu-button-links.js" type="module"></script>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module">
        import { startSessionPolling } from "${url.resourcesPath}/js/authChecker.js";

        startSessionPolling(
          "${url.ssoLoginInOtherTabsUrl?no_esc}"
        );
    </script>
    <#if authenticationSession??>
        <script type="module">
            import { checkAuthSession } from "${url.resourcesPath}/js/authChecker.js";

            checkAuthSession(
                "${authenticationSession.authSessionIdHash}"
            );
        </script>
    </#if>
</head>

<body class="${properties.kcBodyClass!} ${bodyClass}"<#if kcPage?has_content> data-page="${kcPage}"</#if>>
<div class="${properties.kcLoginClass!}">

    <header id="kc-header" class="kc-navbar">
        <div class="kc-navbar__inner">
            <a class="kc-brand" href="${appUrl?has_content?then(appUrl, '#')}">
                <img class="kc-brand__logo" src="${sharedPath}/img/logo.png" alt="" width="32" height="32">
            </a>
            <#if showLocales>
                <nav class="kc-nav" aria-label="${msg("kcAuthNavigation")}">
                    <div class="${properties.kcLocaleMainClass!}" id="kc-locale">
                        <div id="kc-locale-wrapper" class="${properties.kcLocaleWrapperClass!}">
                            <div id="kc-locale-dropdown" class="menu-button-links ${properties.kcLocaleDropDownClass!}">
                                <button tabindex="1" id="kc-current-locale-link" class="kc-nav__link kc-dropdown__toggle" aria-label="${msg("kcAuthLanguages")}" aria-haspopup="true" aria-expanded="false" aria-controls="language-switch1">
                                    <i class="bi bi-globe" aria-hidden="true"></i>
                                    <span>${locale.current}</span>
                                    <i class="bi bi-chevron-down kc-dropdown__caret" aria-hidden="true"></i>
                                </button>
                                <ul role="menu" tabindex="-1" aria-labelledby="kc-current-locale-link" aria-activedescendant="" id="language-switch1" class="${properties.kcLocaleListClass!}">
                                    <#assign i = 1>
                                    <#list locale.supported as l>
                                        <li class="${properties.kcLocaleListItemClass!}" role="none">
                                            <a role="menuitem" id="language-${i}" class="${properties.kcLocaleItemClass!}<#if l.label == locale.current> is-active</#if>" href="${l.url}">${l.label}</a>
                                        </li>
                                        <#assign i++>
                                    </#list>
                                </ul>
                            </div>
                        </div>
                    </div>
                </nav>
            </#if>
        </div>
    </header>

    <main class="kc-main">
        <div class="container">
            <div class="kc-layout">
                <#if heroImage?has_content>
                    <div class="kc-hero" aria-hidden="true">
                        <img src="${sharedPath}/${heroImage}" alt="" width="800" height="800">
                    </div>
                </#if>

                <div class="${properties.kcFormCardClass!}">
                    <header class="${properties.kcFormHeaderClass!}">
                        <h1 id="kc-page-title" class="kc-title">
                            <#if clientLogo?has_content>
                                <img class="kc-title__icon kc-title__icon--logo" src="${clientLogo}" alt="">
                            <#else>
                                <i class="bi bi-${pageIcon} kc-title__icon" aria-hidden="true"></i>
                            </#if>
                            <span class="kc-title__text"><#nested "header"></span>
                        </h1>

                        <#if displayRequiredFields>
                            <p class="kc-required-hint"><span class="required">*</span> ${msg("requiredFields")}</p>
                        </#if>

                        <#if auth?has_content && auth.showUsername() && !auth.showResetCredentials()>
                            <#nested "show-username">
                            <div id="kc-username" class="kc-username">
                                <i class="bi bi-person" aria-hidden="true"></i>
                                <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                                <a id="reset-login" class="kc-username__reset" href="${url.loginRestartFlowUrl}" aria-label="${msg("restartLoginTooltip")}" title="${msg("restartLoginTooltip")}">
                                    <i class="${properties.kcResetFlowIcon!}" aria-hidden="true"></i>
                                </a>
                            </div>
                        </#if>
                    </header>

                    <div id="kc-content">
                        <div id="kc-content-wrapper">

                            <#-- App-initiated actions should not see warning messages about the need to complete the action during login. -->
                            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                                <div class="alert-${message.type} ${properties.kcAlertClass!}" role="<#if message.type = 'error'>alert<#else>status</#if>">
                                    <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}" aria-hidden="true"></span></#if>
                                    <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}" aria-hidden="true"></span></#if>
                                    <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}" aria-hidden="true"></span></#if>
                                    <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}" aria-hidden="true"></span></#if>
                                    <span class="${properties.kcAlertTitleClass!}">${kcSanitize(message.summary)?no_esc}</span>
                                </div>
                            </#if>

                            <#nested "form">

                            <#if auth?has_content && auth.showTryAnotherWayLink()>
                                <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                                    <div class="${properties.kcFormGroupClass!}">
                                        <input type="hidden" name="tryAnotherWay" value="on"/>
                                        <a href="#" id="try-another-way"
                                           onclick="document.forms['kc-select-try-another-way-form'].requestSubmit();return false;">${msg("doTryAnotherWay")}</a>
                                    </div>
                                </form>
                            </#if>

                            <#nested "socialProviders">

                            <#if displayInfo>
                                <div id="kc-info" class="${properties.kcSignUpClass!}">
                                    <div id="kc-info-wrapper" class="${properties.kcInfoAreaWrapperClass!}">
                                        <#nested "info">
                                    </div>
                                    <img class="kc-info__logo" src="${sharedPath}/img/logo.png" alt="" width="48" height="48">
                                </div>
                            </#if>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <footer class="kc-footer">
        <div class="container">
            <@loginFooter.content/>
            <span class="kc-footer__brand"><strong>${realm.displayName!realm.name}</strong> ${msg("kcAuthFooter")}</span>
        </div>
    </footer>
</div>
</body>
</html>
</#macro>
