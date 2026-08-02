---
type: "query"
date: "2026-08-01T22:29:23.859146+00:00"
question: "Expo Go logs expo-notifications warnings and RNGoogleMobileAdsModule could not be found"
contributor: "graphify"
outcome: "useful"
source_nodes: ["deviceService.js", "notificationService.js", "AdsContext.native.jsx", "adInit.native.js", "AdBanner.native.jsx"]
---

# Q: Expo Go logs expo-notifications warnings and RNGoogleMobileAdsModule could not be found

## Answer

Expanded from original query via graph vocab: [ads, banner, consent, context, device, expo, google, init, mobile, module, notification, provider]. The graph connected deviceService.js to notificationService.js and identified AdsContext.native.jsx, adInit.native.js, and AdBanner.native.jsx as the native ad path. Static imports executed unsupported native packages before the Expo Go guard. The fix gates conditional require calls with isRunningInExpoGo, keeps development and production builds enabled, and uses local official Google demo banner IDs so ads config itself is native-module-free.

## Outcome

- Signal: useful

## Source Nodes

- deviceService.js
- notificationService.js
- AdsContext.native.jsx
- adInit.native.js
- AdBanner.native.jsx