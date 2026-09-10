---
type: "query"
date: "2026-09-08T17:46:12.592057+00:00"
question: "Why did hidden bottom sheets and notification drawer break after Expo SDK 57?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["BottomSheet", "TabNavigator", "NotificationInboxPanel"]
---

# Q: Why did hidden bottom sheets and notification drawer break after Expo SDK 57?

## Answer

Expanded via graph vocabulary: BottomSheet, NotificationInboxPanel, TabNavigator. @gorhom/bottom-sheet 5.2.14 leaves an initially hidden modal in DISMISSING when the controlled wrapper calls dismiss before first present; presentedRef now skips that initial dismiss. The notification underlay must remain below appShellMotion and drawerProgress swaps panel/card background colors while the shell moves.

## Outcome

- Signal: useful

## Source Nodes

- BottomSheet
- TabNavigator
- NotificationInboxPanel