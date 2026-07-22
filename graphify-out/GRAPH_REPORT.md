# Graph Report - .  (2026-07-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1109 nodes · 3472 edges · 96 communities (38 shown, 58 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1a4e4c08`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 28
- Community 29
- Community 30
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 95

## God Nodes (most connected - your core abstractions)
1. `t()` - 123 edges
2. `useScheduleData()` - 108 edges
3. `triggerHaptic()` - 99 edges
4. `themes` - 47 edges
5. `useScheduleActions()` - 44 edges
6. `FileLibraryScreen()` - 35 edges
7. `TaskEditor()` - 34 edges
8. `ScheduleProvider()` - 28 edges
9. `AttachmentManager()` - 26 edges
10. `scripts` - 25 edges

## Surprising Connections (you probably didn't know these)
- `LessonEditorMainScreen()` --references--> `react`  [EXTRACTED]
  src/pages/Schedule/components/LessonEditor/screens/MainScreen.jsx → package.json
- `ScheduleEditorScreen()` --references--> `react`  [EXTRACTED]
  src/pages/Settings/components/ScheduleEditorScreen.jsx → package.json
- `InputField()` --calls--> `triggerHaptic()`  [EXTRACTED]
  src/auth/AuthScreen.jsx → src/utils/haptics.js
- `AttachmentImagePreview()` --indirect_call--> `triggerHaptic()`  [INFERRED]
  src/components/attachments/AttachmentImagePreview.jsx → src/utils/haptics.js
- `SettingsStack()` --calls--> `useScheduleData()`  [EXTRACTED]
  src/navigation/TabNavigator.jsx → src/context/ScheduleProvider.jsx

## Import Cycles
- None detected.

## Communities (96 total, 58 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (93): MigrationModal(), styles, SheetFlatList, createDefaultData(), defaultSchedule, cleanupStateByUser, deleteAllUserData(), deleteUserSchedule() (+85 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (81): react, react, NOTIFICATION_TYPE_CONFIG, NotificationDrawerContext, NotificationDrawerProvider(), useNotificationDrawer(), useNotifications(), AnimatedTouchable (+73 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (79): getIconComponent(), DayScheduleContext, DayScheduleProvider(), deepClone(), generateLocalId(), LessonEditor(), timeToMins(), DayPage (+71 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (50): CACHE_FRESH_STATUSES, canUseCachedAttachment(), componentToHex(), COMPRESSIBLE_IMAGE_MIME_TYPES, compressNativeImageAttachment(), compressWebImageAttachment(), createNativeAttachmentImagePreview(), createNativeCompressedImageCandidate() (+42 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (39): TermsCheckbox(), CalendarGrid(), DayCell, styles, CalendarSheet(), styles, useCalendarLogic(), GlobalShareHandler() (+31 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (45): getAppHeaderHeight(), getAppHeaderTopInset(), AnimatedTouchableOpacity, areSameIds(), buildTaskListRows(), compareTaskScheduleNames(), formatPendingTaskCountLabel(), formatTaskCardDate() (+37 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (30): WelcomeContent(), SettingsSelectionRow(), styles, styles, TabSwitcher(), styles, TeacherEditor(), LessonEditorSubjectColorScreen() (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (26): MorphingLoader(), db, firebaseConfig, storageBucketName, themes, SettingsScreenLayout(), styles, AnimatedTouchable (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (27): AdBanner(), styles, styles, ANGLE_OPTIONS, buildPath(), clamp01(), clockwiseLerpAngle(), createFrameQueue() (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (37): versionParts, @babel/core, baseline-browser-mapping, cross-env, devDependencies, @babel/core, baseline-browser-mapping, cross-env (+29 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (24): App(), AUTH_LAYOUT_ANIMATION, AuthScreen(), configureAuthLayoutAnimation(), getIconConfig(), InputField(), styles, getLinkedProviders() (+16 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (40): AttachmentImagePreview(), AttachmentManager(), getAttachmentKindIcon(), interpolate(), styles, LessonViewer(), styles, FileLibraryScreen() (+32 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (16): AppBlur(), SettingsHeader(), styles, SettingsActionRow(), styles, SettingsGroup(), styles, SettingsRow() (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (21): GradientBackground(), ICON_CATEGORIES, SUBJECT_ICONS, createNowTickStore(), isTimerRelevantDate(), NowTickContext, NowTickProvider(), startOfDay() (+13 more)

### Community 14 - "Community 14"
Cohesion: 0.26
Nodes (26): assertImportShape(), clampNumber(), cleanColor(), cleanId(), cleanIdArray(), cleanIsoDate(), cleanOptionalString(), cleanString() (+18 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (20): NAVIGATION_METRICS, NAVIGATION_STYLE_KEYS, ACTIVE_SPRING, BOUNCE_SPRING, PlanItTabBar(), styles, TAB_BAR_VARIANTS, TabItem() (+12 more)

### Community 16 - "Community 16"
Cohesion: 0.20
Nodes (27): cacheAttachmentFromLocalUri(), canUseNativeAttachmentCache(), canUseWebAttachmentCache(), deleteLocalAttachmentCache(), deleteWebAttachmentCacheRecord(), ensureDirectory(), ensureLocalAttachment(), getAttachmentCacheDirectory() (+19 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (18): ShareScheduleModal(), styles, HUE_COLORS, styles, BottomSheet, DEFAULT_SNAP_POINTS, SheetScrollView, styles (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.23
Nodes (10): clampIndex(), dedupeImageAttachments(), GALLERY_SPRING, getAttachmentIdentity(), getAttachmentPreviewUri(), getContainedImageSize(), getKnownAttachmentImageSize(), styles (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (29): buildPickResult(), createAndroidDownloadFile(), createDraftAttachment(), EXACT_MIME_TYPES, getAndroidDownloadFileName(), getAssetFile(), getAssetName(), getAssetSize() (+21 more)

### Community 20 - "Community 20"
Cohesion: 0.37
Nodes (14): countLessons(), getArrayItemsFingerprint(), getAttachmentsFingerprint(), getFileLibraryFingerprint(), getGlobalFingerprint(), getLessonsFingerprint(), getNotificationPreferencesFingerprint(), getReminderFingerprint() (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (14): dotenv, expo-clipboard, @gorhom/bottom-sheet, dependencies, dotenv, expo-clipboard, @gorhom/bottom-sheet, @react-native-google-signin/google-signin (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (13): getAndroidDownloadDirectoryUri(), getAttachmentUploadUserId(), getBlobFromUri(), getCachedAndroidDownloadDirectoryUri(), isRemoteUri(), isSafUri(), makeAttachmentError(), prepareAndroidDownloadAttachment() (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.35
Nodes (8): consoleErrorReports, createSanitizedError(), initGlobalErrorHandling(), logCrashlyticsError(), logCrashlyticsMessage(), sanitizeText(), shouldReportConsoleError(), summarizeValue()

### Community 24 - "Community 24"
Cohesion: 0.31
Nodes (9): AttachmentImageLoadingOverlay(), DEFAULT_COLORS, getAttachmentAspectRatio(), getAttachmentPreview(), getContainedFrameStyle(), getStableImageKey(), normalizePreviewColors(), StagedAttachmentImage() (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.42
Nodes (6): createDefaultGradient(), createDefaultLink(), createDefaultSubject(), createDefaultTeacher(), useEntityManager(), useUniqueId()

### Community 26 - "Community 26"
Cohesion: 0.28
Nodes (7): AdvancedColorPicker(), AppSwitch(), getSize(), SIZES, styles, styles, ThemeSettings()

### Community 28 - "Community 28"
Cohesion: 0.50
Nodes (3): distPath, fs, path

## Knowledge Gaps
- **244 isolated node(s):** `versionParts`, `name`, `version`, `main`, `start` (+239 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 21` to `Community 1`, `Community 9`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 62`, `Community 63`, `Community 64`, `Community 65`, `Community 66`, `Community 67`, `Community 68`, `Community 69`, `Community 70`, `Community 71`, `Community 72`, `Community 73`, `Community 74`, `Community 75`, `Community 76`, `Community 77`, `Community 78`, `Community 79`, `Community 80`, `Community 81`, `Community 82`, `Community 83`, `Community 84`, `Community 85`, `Community 86`?**
  _High betweenness centrality (0.274) - this node is a cross-community bridge._
- **Why does `react` connect `Community 1` to `Community 21`?**
  _High betweenness centrality (0.254) - this node is a cross-community bridge._
- **Why does `t()` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 26`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `OnboardingWizard()` and `ScheduleEditorScreen()`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `versionParts`, `name`, `version` to the rest of the system?**
  _244 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05192107995846314 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.050645007166746296 - nodes in this community are weakly interconnected._