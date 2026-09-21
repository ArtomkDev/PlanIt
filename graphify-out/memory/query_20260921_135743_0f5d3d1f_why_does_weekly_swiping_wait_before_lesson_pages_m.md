---
type: "query"
date: "2026-09-21T13:57:43.639211+00:00"
question: "Why does weekly swiping wait before lesson pages move?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["DayPager", "PagerPage", "WeekStrip", "prepareScheduleDays"]
---

# Q: Why does weekly swiping wait before lesson pages move?

## Answer

Expanded graph vocabulary: pager week prepare schedule. Confirmed in DayPager and prepareWeekWindow: each weekly gesture crossed to JS, replaced the page window, then waited for native layout. Replaced that path with 15 pre-mounted pages covering five nearby days and their adjacent-week counterparts, UI-only week positioning, and no WeekStrip row recentering during the drag. Regression test freezes JS and layout acknowledgements while checking page transforms and mount identities.

## Outcome

- Signal: useful

## Source Nodes

- DayPager
- PagerPage
- WeekStrip
- prepareScheduleDays