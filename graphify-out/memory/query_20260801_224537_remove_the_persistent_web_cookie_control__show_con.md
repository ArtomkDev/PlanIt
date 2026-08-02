---
type: "query"
date: "2026-08-01T22:45:37.950536+00:00"
question: "Remove the persistent web cookie control, show consent automatically only when no choice exists, and move cookie preferences to Settings"
contributor: "graphify"
outcome: "useful"
source_nodes: ["CookieConsentBanner.web.jsx", "cookieConsentService.web.js", "analytics.web.js", "Settings()", "AboutApp()"]
---

# Q: Remove the persistent web cookie control, show consent automatically only when no choice exists, and move cookie preferences to Settings

## Answer

Expanded from the original request via graph vocabulary: [analytics, banner, consent, cookie, cookies, firebase, preference, privacy, settings, storage, web, screen]. Graph traversal identified CookieConsentBanner.web.jsx, cookieConsentService.web.js, and analytics.web.js. The banner now renders automatically only when consent is absent, can be reopened explicitly through the web-only Settings row, and no longer renders a persistent floating control. The former nested About App preference row was removed while Firebase Analytics consent events remain unchanged.

## Outcome

- Signal: useful

## Source Nodes

- CookieConsentBanner.web.jsx
- cookieConsentService.web.js
- analytics.web.js
- Settings()
- AboutApp()