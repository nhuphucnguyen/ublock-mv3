/**
 * Default Curated Filter Rules (Ads, Privacy/Trackers, Annoyances, Social)
 * in standard Adblock Plus / uBlock Origin format.
 */

export const DEFAULT_ADS_RULES = `
! Title: Default Ad Blocking Rules
! Description: Blocks common advertising networks, banners, video ads, and popups
||doubleclick.net^
||googlesyndication.com^
||googleadservices.com^
||pagead2.googlesyndication.com^
||adservice.google.com^
||adnxs.com^
||criteo.com^
||criteo.net^
||taboola.com^
||outbrain.com^
||revcontent.com^
||popads.net^
||popcash.net^
||propellerads.com^
||buysellads.com^
||carbonads.net^
||adroll.com^
||openx.net^
||rubiconproject.com^
||pubmatic.com^
||smartadserver.com^
||advertising.com^
||media.net^
||infolinks.com^
||chitika.net^
||bidvertiser.com^
||mgid.com^
||exponential.com^
||trafficjunky.com^
||exoclick.com^
||juicyads.com^
||adcolony.com^
||vungle.com^
||unityads.unity3d.com^
||adblade.com^
||sovrn.com^
||lijit.com^
||yieldmo.com^
||teads.tv^
||smartclip.net^
||spotxchange.com^
||spotx.tv^
||a-ads.com^
||ad-delivery.net^
||adsystem.com^
||amazon-adsystem.com^
||zedo.com^
||casalemedia.com^
||adtechus.com^
||contextweb.com^
||tribalfusion.com^
||adsonar.com^

! Cosmetic Ad Selectors
##.adsbygoogle
##[id^="div-gpt-ad"]
##[id^="google_ads_iframe"]
##.trc_related_container
##.OUTBRAIN
##.taboola-placeholder
##.taboola
##[class*="-ad-container"]
##[class*="-ad-banner"]
##[id*="-ad-banner"]
##[id*="ad-wrapper"]
##.ad-placement
##.ad-box
##.ad-unit
##.ad-slot
##.ad_banner
##.ad_wrapper
##.advertisement
##.advertising
##.sponsored-post
##.sponsored-content
##.sponsor-banner
##[data-ad-unit]
##[data-ad-client]
##amp-ad
##aside[aria-label="advertisement" i]
##div[data-adzone]
`;

export const DEFAULT_PRIVACY_RULES = `
! Title: Privacy & Tracking Rules
! Description: Blocks analytics, fingerprinting, telemetries, and user tracking beacons
||google-analytics.com^
||analytics.google.com^
||stats.g.doubleclick.net^
||googletagmanager.com/gtm.js$script
||googletagmanager.com/gtag/js$script
||facebook.net/en_US/fbevents.js$script
||connect.facebook.net/signals/config/
||pixel.facebook.com^
||mc.yandex.ru^
||hotjar.com^
||script.hotjar.com^
||mouseflow.com^
||crazyegg.com^
||fullstory.com^
||segment.io^
||cdn.segment.com^
||api.segment.io^
||mixpanel.com^
||api.mixpanel.com^
||scorecardresearch.com^
||sb.scorecardresearch.com^
||quantserve.com^
||pixel.quantserve.com^
||chartbeat.com^
||static.chartbeat.com^
||clarity.ms^
||c.clarity.ms^
||telemetry.
||matomo.org^
||statcounter.com^
||luckyorange.com^
||inspectlet.com^
||optimizely.com^
||cdn.optimizely.com^
||branch.io^
||app.adjust.com^
||appsflyer.com^
||kochava.com^
||ping.chartbeat.net^
`;

export const DEFAULT_ANNOYANCES_RULES = `
! Title: Annoyances & Cookie Banners
! Description: Blocks intrusive consent notices, newsletter nag popups, and notification requests
||cdn.cookielaw.org^
||consent.cookiebot.com^
||consent.trustarc.com^
||fundingchoicesmessages.google.com^
||cmp.uniconsent.com^
||quantcast.mgr.consensu.org^
||privacy-mgmt.onetrust.com^
||geolocation.onetrust.com^
||didomi.io^
||sdk.privacy-center.org^
||usercentrics.eu^

! Cosmetic Cookie Notices & Popups
##.onetrust-pc-dark-filter
###onetrust-consent-sdk
###onetrust-banner-sdk
###CybotCookiebotDialog
###CybotCookiebotDialogBodyUnderlay
##.cookie-banner
##.cookie-consent
##.cookie-notice
##.cookie-bar
##.cookie-popup
##.cookie-alert
##.cookies-eu-box
##.qc-cmp-ui-container
##.didomi-popup-container
###usercentrics-root
##.sp-message-open
##div[id*="cookieConsent"]
##div[class*="cookieConsent"]
`;

export const DEFAULT_SOCIAL_RULES = `
! Title: Social Media Trackers & Widgets
! Description: Blocks third-party social share buttons and tracking widgets
||platform.twitter.com/widgets.js$script
||assets.pinterest.com/js/pinit.js$script
||platform.linkedin.com/in.js$script
||apis.google.com/js/plusone.js$script
||connect.facebook.net/*/sdk.js$script
||platform.instagram.com/en_US/embeds.js$script
||tiktok.com/embed.js$script
||sharethis.com^
||addthis.com^
||api.addthis.com^
`;
