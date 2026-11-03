---
type: "query"
date: "2026-10-30T07:30:46.058592+00:00"
question: "Android bottom edge exposes hidden notification content below both app tabs and system navigation"
contributor: "graphify"
outcome: "useful"
source_nodes: ["TabNavigator.jsx", "MainLayout.jsx", "PlanItTabBar.jsx"]
---

# Q: Android bottom edge exposes hidden notification content below both app tabs and system navigation

## Answer

Expanded via graph vocabulary: android navigation tab bar safe area layout. TabNavigator owns the animated app shell and notification underlay; MainLayout owns system icon styling and window color; PlanItTabBar owns tab metrics and bottom padding. Confirmed source and a physical Samsung SM-A750FN Android 10 screenshot: the final display row exposed underlay content. Added a stationary Android system-navigation background as a sibling above the animated shell, sized by useSafeAreaInsets bottom and themed with backgroundColorTabNavigator. All 100 navigation, ads and native-guard tests passed, and the release APK built successfully. Updated the phone with the matching debug signing certificate without uninstalling or clearing data. Verified Schedule, Settings and the original Theme screen: all 1080 pixels of the last display row are now the solid navigation color #1e1e22; the original screenshot had 130 light text pixels leaking through. Test APK and R8 mapping are retained under builds/PlanIt-TestAds_v0.1.81_2026-10-30_bottom-navigation*.

## Outcome

- Signal: useful

## Source Nodes

- TabNavigator.jsx
- MainLayout.jsx
- PlanItTabBar.jsx
