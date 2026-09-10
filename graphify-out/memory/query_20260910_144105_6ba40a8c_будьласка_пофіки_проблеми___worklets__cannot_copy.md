---
type: "query"
date: "2026-09-10T14:41:05.224515+00:00"
question: "будьласка пофіки проблеми: [Worklets] Cannot copy value of type AnimatedValue"
contributor: "graphify"
outcome: "useful"
source_nodes: ["TabNavigator.jsx", "Schedule.jsx", "react-native-reanimated", "react-native-worklets"]
---

# Q: будьласка пофіки проблеми: [Worklets] Cannot copy value of type AnimatedValue

## Answer

Expanded from original query via graph vocab: [worklets, animated, reanimated, shared, value, gesture, style, spring]. Root cause: TabNavigator exposed a React Native Animated.Value to useAnimatedStyle worklets in Schedule, Header, WeekStrip, and AppBlur. Fixed by making drawerProgress a Reanimated shared value and moving drawer transform, scale, corner radius, overlay opacity, timing, and gesture updates onto the Reanimated UI thread. Native guard tests pass 8/8 and the iOS Hermes bundle exports successfully.

## Outcome

- Signal: useful

## Source Nodes

- TabNavigator.jsx
- Schedule.jsx
- react-native-reanimated
- react-native-worklets