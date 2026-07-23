# Graph Report - PlanIt  (2026-07-23)

## Corpus Check
- 146 files · ~179,350 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1127 nodes · 3493 edges · 108 communities (49 shown, 59 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `77f200cb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MigrationModal.jsx
- notificationService.js
- TaskEditor.jsx
- attachmentService.js
- ScheduleProvider.jsx
- Tasks.jsx
- t
- TabNavigator.jsx
- MorphingLoader.jsx
- scripts
- AuthScreen.jsx
- FileLibraryScreen.jsx
- triggerHaptic
- LessonCard.jsx
- scheduleValidation.js
- NavigationSettings.jsx
- ensureLocalAttachment
- ShareScheduleModal.jsx
- AttachmentImagePreview.jsx
- uploadAttachmentDraft
- scheduleDataFingerprint.js
- dependencies
- makeAttachmentError
- crashlytics.native.js
- StagedAttachmentImage.jsx
- Schedule.jsx
- ThemeSettings.jsx
- fix-build.js
- AdBanner.web.jsx
- ExpandableCard.jsx
- date-fns
- expo
- expo-apple-authentication
- expo-blur
- taskLessonLinking.js
- expo-crypto
- expo-dev-client
- expo-device
- expo-document-picker
- expo-haptics
- expo-image-manipulator
- expo-image-picker
- expo-linear-gradient
- expo-linking
- expo-localization
- @expo/metro-runtime
- @expo/ngrok
- expo-notifications
- expo-sharing
- expo-splash-screen
- expo-status-bar
- expo-updates
- firebase
- phosphor-react-native
- react-datepicker
- react-dom
- react-native
- react-native-android-widget
- @react-native-assets/slider
- @react-native-async-storage/async-storage
- @react-native-community/blur
- @react-native-community/datetimepicker
- @react-native-community/netinfo
- react-native-date-picker
- react-native-device-info
- @react-native-firebase/analytics
- @react-native-firebase/app
- @react-native-firebase/crashlytics
- react-native-gesture-handler
- react-native-get-random-values
- react-native-google-mobile-ads
- react-native-pager-view
- @react-native-picker/picker
- react-native-reanimated
- scheduleDocumentCodec.js
- react-native-screens
- react-native-svg
- react-native-vector-icons
- react-native-web
- react-native-worklets
- react-native-worklets-core
- @react-navigation/bottom-tabs
- firestore.js
- @react-navigation/native
- uuid
- encodedStoragePrefix
- haptics.js
- widgetTask.js
- ScheduleProvider
- Graphify Setup
- Project Instructions
- createDefaultData.js
- @react-native-google-signin/google-signin
- @react-navigation/stack
- tinycolor2
- @gorhom/bottom-sheet
- react
- expo-constants

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
- `TabItem()` --calls--> `triggerHaptic()`  [EXTRACTED]
  src/navigation/PlanItTabBar.jsx → src/utils/haptics.js

## Import Cycles
- None detected.

## Communities (108 total, 59 thin omitted)

### Community 0 - "MigrationModal.jsx"
Cohesion: 0.16
Nodes (30): getIconComponent(), buildDateOnlyLessonRef(), buildTaskEditorSessionKey(), colorWithAlpha(), deepCloneArray(), formatOccurrenceCount(), formatOccurrenceWeekLabel(), getGradientColors() (+22 more)

### Community 1 - "notificationService.js"
Cohesion: 0.06
Nodes (77): react, react, NOTIFICATION_TYPE_CONFIG, NotificationDrawerContext, NotificationDrawerProvider(), useNotificationDrawer(), useNotifications(), LessonEditorMainScreen() (+69 more)

### Community 2 - "TaskEditor.jsx"
Cohesion: 0.19
Nodes (25): getLessonData(), getLessonSubjectId(), buildScheduleGroupedLessonCatalogue(), buildScheduleLessonGroups(), buildTaskLessonOptions(), createLessonRefForDate(), createLessonRefFromOccurrence(), createTaskDraftFromLesson() (+17 more)

### Community 3 - "attachmentService.js"
Cohesion: 0.07
Nodes (52): CACHE_FRESH_STATUSES, canUseCachedAttachment(), componentToHex(), COMPRESSIBLE_IMAGE_MIME_TYPES, compressNativeImageAttachment(), compressWebImageAttachment(), createNativeAttachmentImagePreview(), createNativeCompressedImageCandidate() (+44 more)

### Community 4 - "ScheduleProvider.jsx"
Cohesion: 0.16
Nodes (19): deleteAllUserData(), getActiveScheduleFromData(), hasDirtyScheduleData(), isSameGlobalDraft(), resolveSyncConflict(), ScheduleActionsContext, ScheduleContext, ScheduleDataContext (+11 more)

### Community 5 - "Tasks.jsx"
Cohesion: 0.11
Nodes (32): getAppHeaderTopInset(), styles, TaskScheduleFilterSheet(), uniqueIds(), AnimatedTouchableOpacity, areSameIds(), buildTaskListRows(), compareTaskScheduleNames() (+24 more)

### Community 6 - "t"
Cohesion: 0.08
Nodes (29): AdvancedColorPicker(), HUE_COLORS, styles, SettingsActionRow(), styles, SettingsSelectionRow(), styles, styles (+21 more)

### Community 7 - "TabNavigator.jsx"
Cohesion: 0.17
Nodes (15): AppBlur(), MorphingLoader(), styles, themes, SettingsScreenLayout(), styles, getStyles(), getStyles() (+7 more)

### Community 8 - "MorphingLoader.jsx"
Cohesion: 0.08
Nodes (26): AdBanner(), styles, styles, ANGLE_OPTIONS, buildPath(), clamp01(), clockwiseLerpAngle(), createFrameQueue() (+18 more)

### Community 9 - "scripts"
Cohesion: 0.05
Nodes (37): versionParts, @babel/core, baseline-browser-mapping, cross-env, devDependencies, @babel/core, baseline-browser-mapping, cross-env (+29 more)

### Community 10 - "AuthScreen.jsx"
Cohesion: 0.06
Nodes (35): App(), AUTH_LAYOUT_ANIMATION, AuthScreen(), configureAuthLayoutAnimation(), getIconConfig(), InputField(), styles, TermsCheckbox() (+27 more)

### Community 11 - "FileLibraryScreen.jsx"
Cohesion: 0.16
Nodes (39): AttachmentImagePreview(), AttachmentManager(), getAttachmentKindIcon(), interpolate(), styles, LessonViewer(), styles, FileLibraryScreen() (+31 more)

### Community 12 - "triggerHaptic"
Cohesion: 0.27
Nodes (6): CalendarGrid(), DayCell, styles, CalendarSheet(), styles, useCalendarLogic()

### Community 13 - "LessonCard.jsx"
Cohesion: 0.07
Nodes (53): GradientBackground(), getAppHeaderHeight(), ICON_CATEGORIES, SUBJECT_ICONS, DayScheduleContext, DayScheduleProvider(), useDaySchedule(), useScheduleLayout() (+45 more)

### Community 14 - "scheduleValidation.js"
Cohesion: 0.26
Nodes (26): assertImportShape(), clampNumber(), cleanColor(), cleanId(), cleanIdArray(), cleanIsoDate(), cleanOptionalString(), cleanString() (+18 more)

### Community 15 - "NavigationSettings.jsx"
Cohesion: 0.15
Nodes (12): NAVIGATION_METRICS, NAVIGATION_STYLE_KEYS, ACTIVE_SPRING, BOUNCE_SPRING, styles, TAB_BAR_VARIANTS, TabItem(), hexToRgba() (+4 more)

### Community 16 - "ensureLocalAttachment"
Cohesion: 0.24
Nodes (24): cacheAttachmentFromLocalUri(), canUseNativeAttachmentCache(), canUseWebAttachmentCache(), deleteLocalAttachmentCache(), deleteWebAttachmentCacheRecord(), ensureDirectory(), ensureLocalAttachment(), getAttachmentCacheDirectory() (+16 more)

### Community 17 - "ShareScheduleModal.jsx"
Cohesion: 0.10
Nodes (42): useRequiredScheduleContext(), useScheduleActions(), useScheduleData(), useScheduleSync(), MainLayout(), MainStack, styles, PlanItTabBar() (+34 more)

### Community 18 - "AttachmentImagePreview.jsx"
Cohesion: 0.20
Nodes (13): clampIndex(), dedupeImageAttachments(), GALLERY_SPRING, getAttachmentIdentity(), getAttachmentLoadKey(), getAttachmentPreviewUri(), getAttachmentRenderRevision(), getContainedImageSize() (+5 more)

### Community 19 - "uploadAttachmentDraft"
Cohesion: 0.12
Nodes (31): buildPickResult(), createAndroidDownloadFile(), createAttachmentReference(), createDraftAttachment(), EXACT_MIME_TYPES, getAndroidDownloadFileName(), getAssetFile(), getAssetName() (+23 more)

### Community 20 - "scheduleDataFingerprint.js"
Cohesion: 0.37
Nodes (14): countLessons(), getArrayItemsFingerprint(), getAttachmentsFingerprint(), getFileLibraryFingerprint(), getGlobalFingerprint(), getLessonsFingerprint(), getNotificationPreferencesFingerprint(), getReminderFingerprint() (+6 more)

### Community 21 - "dependencies"
Cohesion: 0.13
Nodes (15): dotenv, expo-blur, expo-clipboard, @gorhom/bottom-sheet, dependencies, dotenv, expo-blur, expo-clipboard (+7 more)

### Community 22 - "makeAttachmentError"
Cohesion: 0.23
Nodes (13): getAndroidDownloadDirectoryUri(), getAttachmentUploadUserId(), getBlobFromUri(), getCachedAndroidDownloadDirectoryUri(), isRemoteUri(), isSafUri(), makeAttachmentError(), prepareAndroidDownloadAttachment() (+5 more)

### Community 23 - "crashlytics.native.js"
Cohesion: 0.35
Nodes (8): consoleErrorReports, createSanitizedError(), initGlobalErrorHandling(), logCrashlyticsError(), logCrashlyticsMessage(), sanitizeText(), shouldReportConsoleError(), summarizeValue()

### Community 24 - "StagedAttachmentImage.jsx"
Cohesion: 0.26
Nodes (12): AttachmentImageLoadingOverlay(), DEFAULT_COLORS, getAttachmentAspectRatio(), getAttachmentPreview(), getContainedFrameStyle(), getStableImageKey(), getStableImageLoadKey(), getStableImageRevision() (+4 more)

### Community 25 - "Schedule.jsx"
Cohesion: 0.18
Nodes (13): AppSwitch(), getSize(), SIZES, styles, SettingsHeader(), SettingsGroup(), styles, SettingsRow() (+5 more)

### Community 26 - "ThemeSettings.jsx"
Cohesion: 0.20
Nodes (18): baseReverseDic, compress(), compressToUriSafe(), decodeStorageValue(), decompress(), decompressFromUriSafe(), getBaseValue(), hasOwn() (+10 more)

### Community 28 - "fix-build.js"
Cohesion: 0.50
Nodes (3): distPath, fs, path

### Community 32 - "date-fns"
Cohesion: 0.35
Nodes (10): MigrationModal(), styles, SheetFlatList, encodeStorageValue(), encodeGlobalDocument(), clearLocalSchedule(), getLocalSchedule(), getStorageKey() (+2 more)

### Community 35 - "expo-blur"
Cohesion: 0.31
Nodes (9): getDimmedCardColor(), getDimmedGradientForText(), getGradientColor(), getGradientColors(), getReadableTextColor(), getTaskLessonTimeLabel(), getTaskTextColor(), TaskCard() (+1 more)

### Community 36 - "taskLessonLinking.js"
Cohesion: 0.14
Nodes (9): AnimatedTouchable, Header(), isSameDay(), styles, AnimatedTouchable, DayButton, styles, WeekStrip (+1 more)

### Community 54 - "firebase"
Cohesion: 0.16
Nodes (14): ImportScheduleModal(), styles, ShareScheduleModal(), styles, BottomSheet, DEFAULT_SNAP_POINTS, SheetScrollView, styles (+6 more)

### Community 73 - "react-native-pager-view"
Cohesion: 0.42
Nodes (6): createDefaultGradient(), createDefaultLink(), createDefaultSubject(), createDefaultTeacher(), useEntityManager(), useUniqueId()

### Community 76 - "scheduleDocumentCodec.js"
Cohesion: 0.53
Nodes (5): db, createSharedSchedule(), generateShareCode(), normalizeCodeLength(), encodeSharedScheduleDocument()

### Community 84 - "firestore.js"
Cohesion: 0.16
Nodes (32): createDefaultData(), cleanupStateByUser, deleteUserSchedule(), ensureVersioning(), getCleanupWatermark(), getDeviceSyncWatermark(), getSchedule(), getScheduleFromServer() (+24 more)

### Community 85 - "@react-navigation/native"
Cohesion: 0.44
Nodes (9): addScheduleRecordToMap(), ARRAY_FIELDS, chooseStartingWeek(), getArrayScore(), getCompletenessScore(), isValidDateValue(), isValidRepeatValue(), mergeScheduleRecords() (+1 more)

### Community 99 - "Graphify Setup"
Cohesion: 0.29
Nodes (6): Build the Project Graph, Codex Integration, Graphify Setup, Install the CLI, Query the Graph, Team Notes

### Community 100 - "Project Instructions"
Cohesion: 0.50
Nodes (3): Graphify, graphify, Project Instructions

### Community 104 - "tinycolor2"
Cohesion: 0.52
Nodes (5): formatTime(), parseRealSchedule(), buildScale(), ICON_COFFEE_TEMPLATE(), ScheduleWidget()

## Knowledge Gaps
- **255 isolated node(s):** `versionParts`, `name`, `version`, `main`, `start` (+250 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `notificationService.js`, `scripts`, `expo`, `expo-apple-authentication`, `expo-crypto`, `expo-dev-client`, `expo-device`, `expo-document-picker`, `expo-haptics`, `expo-image-manipulator`, `expo-image-picker`, `expo-linear-gradient`, `expo-linking`, `expo-localization`, `@expo/metro-runtime`, `@expo/ngrok`, `expo-notifications`, `expo-sharing`, `expo-splash-screen`, `expo-status-bar`, `expo-updates`, `phosphor-react-native`, `react-datepicker`, `react-dom`, `react-native`, `react-native-android-widget`, `@react-native-assets/slider`, `@react-native-async-storage/async-storage`, `@react-native-community/blur`, `@react-native-community/datetimepicker`, `@react-native-community/netinfo`, `react-native-date-picker`, `react-native-device-info`, `@react-native-firebase/analytics`, `@react-native-firebase/app`, `@react-native-firebase/crashlytics`, `react-native-gesture-handler`, `react-native-get-random-values`, `react-native-google-mobile-ads`, `@react-native-picker/picker`, `react-native-reanimated`, `react-native-screens`, `react-native-svg`, `react-native-vector-icons`, `react-native-web`, `react-native-worklets`, `react-native-worklets-core`, `@react-navigation/bottom-tabs`, `uuid`, `haptics.js`, `widgetTask.js`, `ScheduleProvider`, `createDefaultData.js`, `@react-native-google-signin/google-signin`, `@react-navigation/stack`, `@gorhom/bottom-sheet`, `expo-constants`?**
  _High betweenness centrality (0.263) - this node is a cross-community bridge._
- **Why does `react` connect `notificationService.js` to `dependencies`?**
  _High betweenness centrality (0.243) - this node is a cross-community bridge._
- **Why does `ScheduleEditorScreen()` connect `notificationService.js` to `TaskEditor.jsx`, `Tasks.jsx`, `t`, `LessonCard.jsx`, `ShareScheduleModal.jsx`, `uploadAttachmentDraft`, `Schedule.jsx`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `OnboardingWizard()` and `ScheduleEditorScreen()`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `versionParts`, `name`, `version` to the rest of the system?**
  _255 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `notificationService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05533279871692061 - nodes in this community are weakly interconnected._
- **Should `attachmentService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07256894049346879 - nodes in this community are weakly interconnected._