# Graph Report - PlanIt  (2026-07-24)

## Corpus Check
- 158 files · ~197,377 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1262 nodes · 3740 edges · 117 communities (59 shown, 58 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5c7892a4`
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
- crashlytics.web.js
- fix-build.js
- AdBanner.web.jsx
- ExpandableCard.jsx
- analytics.native.js
- date-fns
- expo
- expo-apple-authentication
- expo-blur
- taskLessonLinking.js
- expo-dev-client
- expo-device
- expo-document-picker
- expo-haptics
- expo-image-manipulator
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
- adInit.native.js
- adInit.web.js
- babel.config.js
- build-aab.ps1
- build-android.ps1
- build-dev.ps1
- graphify.ps1
- AndroidPagerView.android.js
- encodedStoragePrefix
- haptics.js
- widgetTask.js
- ScheduleProvider
- Graphify Setup
- Project Instructions
- react-native-gesture-handler
- encodedStoragePrefix
- @react-navigation/stack
- Account deletion deployment
- date-fns
- DeviceManagement.jsx
- @expo/metro-runtime

## God Nodes (most connected - your core abstractions)
1. `t()` - 125 edges
2. `useScheduleData()` - 108 edges
3. `triggerHaptic()` - 99 edges
4. `themes` - 47 edges
5. `useScheduleActions()` - 44 edges
6. `FileLibraryScreen()` - 35 edges
7. `TaskEditor()` - 34 edges
8. `scripts` - 27 edges
9. `ScheduleProvider()` - 27 edges
10. `AttachmentManager()` - 26 edges

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

## Communities (117 total, 58 thin omitted)

### Community 0 - "MigrationModal.jsx"
Cohesion: 0.12
Nodes (35): react, react, SettingsActionRow(), styles, SettingsGroup(), styles, SettingsRow(), styles (+27 more)

### Community 1 - "notificationService.js"
Cohesion: 0.08
Nodes (48): CACHE_FRESH_STATUSES, canUseCachedAttachment(), componentToHex(), COMPRESSIBLE_IMAGE_MIME_TYPES, compressNativeImageAttachment(), compressWebImageAttachment(), createNativeAttachmentImagePreview(), createNativeCompressedImageCandidate() (+40 more)

### Community 2 - "TaskEditor.jsx"
Cohesion: 0.10
Nodes (34): AnimatedTouchableOpacity, areSameIds(), buildTaskListRows(), compareTaskScheduleNames(), formatPendingTaskCountLabel(), formatTaskCardDate(), formatTaskCountLabel(), formatTasksHeaderSummary() (+26 more)

### Community 3 - "attachmentService.js"
Cohesion: 0.26
Nodes (26): assertImportShape(), clampNumber(), cleanColor(), cleanId(), cleanIdArray(), cleanIsoDate(), cleanOptionalString(), cleanString() (+18 more)

### Community 4 - "ScheduleProvider.jsx"
Cohesion: 0.06
Nodes (47): App(), AUTH_LAYOUT_ANIMATION, AuthScreen(), configureAuthLayoutAnimation(), getIconConfig(), InputField(), styles, createAppleSignInNonce() (+39 more)

### Community 5 - "Tasks.jsx"
Cohesion: 0.10
Nodes (23): WelcomeContent(), ShareScheduleModal(), styles, styles, TabSwitcher(), styles, HUE_COLORS, InlineColorPicker() (+15 more)

### Community 6 - "t"
Cohesion: 0.11
Nodes (28): MorphingLoader(), SettingsHeader(), styles, themes, useScheduleLayout(), SettingsScreenLayout(), styles, DRAWER_MOTION_EASING (+20 more)

### Community 7 - "TabNavigator.jsx"
Cohesion: 0.16
Nodes (37): AttachmentImagePreview(), AttachmentManager(), getAttachmentKindIcon(), interpolate(), styles, LessonViewer(), styles, FileLibraryScreen() (+29 more)

### Community 8 - "MorphingLoader.jsx"
Cohesion: 0.05
Nodes (39): versionParts, @babel/core, baseline-browser-mapping, cross-env, devDependencies, @babel/core, baseline-browser-mapping, cross-env (+31 more)

### Community 9 - "scripts"
Cohesion: 0.08
Nodes (26): AdBanner(), styles, styles, ANGLE_OPTIONS, buildPath(), clamp01(), clockwiseLerpAngle(), createFrameQueue() (+18 more)

### Community 10 - "AuthScreen.jsx"
Cohesion: 0.13
Nodes (20): styles, AdvancedColorPicker(), HUE_COLORS, styles, BottomSheet, DEFAULT_SNAP_POINTS, SheetScrollView, styles (+12 more)

### Community 11 - "FileLibraryScreen.jsx"
Cohesion: 0.16
Nodes (13): TermsCheckbox(), CalendarGrid(), DayCell, styles, CalendarSheet(), styles, useCalendarLogic(), GlobalShareHandler() (+5 more)

### Community 12 - "triggerHaptic"
Cohesion: 0.16
Nodes (29): getIconComponent(), buildDateOnlyLessonRef(), buildTaskEditorSessionKey(), colorWithAlpha(), deepCloneArray(), formatOccurrenceCount(), formatOccurrenceWeekLabel(), getGradientColors() (+21 more)

### Community 13 - "LessonCard.jsx"
Cohesion: 0.20
Nodes (13): clampIndex(), dedupeImageAttachments(), GALLERY_SPRING, getAttachmentIdentity(), getAttachmentLoadKey(), getAttachmentPreviewUri(), getAttachmentRenderRevision(), getContainedImageSize() (+5 more)

### Community 14 - "scheduleValidation.js"
Cohesion: 0.11
Nodes (21): GradientBackground(), ICON_CATEGORIES, SUBJECT_ICONS, createNowTickStore(), isTimerRelevantDate(), NowTickContext, NowTickProvider(), startOfDay() (+13 more)

### Community 15 - "NavigationSettings.jsx"
Cohesion: 0.14
Nodes (30): buildPickResult(), createAndroidDownloadFile(), createAttachmentReference(), createDraftAttachment(), EXACT_MIME_TYPES, getAndroidDownloadFileName(), getAssetFile(), getAssetName() (+22 more)

### Community 16 - "ensureLocalAttachment"
Cohesion: 0.18
Nodes (29): cacheAttachmentFromLocalUri(), canUseNativeAttachmentCache(), canUseWebAttachmentCache(), clearAllLocalAttachmentCaches(), deleteLocalAttachmentCache(), deleteWebAttachmentCacheRecord(), ensureDirectory(), ensureLocalAttachment() (+21 more)

### Community 17 - "ShareScheduleModal.jsx"
Cohesion: 0.24
Nodes (21): areLessonRefsSame(), buildScheduleGroupedLessonCatalogue(), buildTaskLessonOptions(), createLessonRefForDate(), createLessonRefFromOccurrence(), createTaskDraftFromLesson(), createTaskDraftFromLessonContext(), createTaskDraftFromOccurrence() (+13 more)

### Community 18 - "AttachmentImagePreview.jsx"
Cohesion: 0.12
Nodes (16): firebase-admin, firebase-functions, dependencies, firebase-admin, firebase-functions, jose, engines, node (+8 more)

### Community 19 - "uploadAttachmentDraft"
Cohesion: 0.45
Nodes (12): clearConsentExpiryTimer(), createBrowserEvent(), dispatchConsentChange(), getBrowserWindow(), isConsentStatus(), readCookieConsent(), removeStoredConsent(), requestCookiePreferences() (+4 more)

### Community 20 - "scheduleDataFingerprint.js"
Cohesion: 0.05
Nodes (94): MigrationModal(), styles, SheetFlatList, createDefaultData(), defaultSchedule, cleanupStateByUser, deleteUserSchedule(), ensureVersioning() (+86 more)

### Community 21 - "dependencies"
Cohesion: 0.40
Nodes (4): AnimatedTouchable, DayButton, styles, WeekStrip

### Community 22 - "makeAttachmentError"
Cohesion: 0.14
Nodes (29): getAppHeaderHeight(), getAppHeaderTopInset(), DayScheduleContext, DayScheduleProvider(), useDaySchedule(), DaySchedule(), { height: SCREEN_HEIGHT }, styles (+21 more)

### Community 23 - "crashlytics.native.js"
Cohesion: 0.14
Nodes (13): NAVIGATION_METRICS, NAVIGATION_STYLE_KEYS, ACTIVE_SPRING, BOUNCE_SPRING, PlanItTabBar(), styles, TAB_BAR_VARIANTS, TabItem() (+5 more)

### Community 24 - "StagedAttachmentImage.jsx"
Cohesion: 0.20
Nodes (13): APPLE_CLIENT_ID, APPLE_JWKS, APPLE_KEY_ID, APPLE_KEYS_URL, APPLE_PRIVATE_KEY, APPLE_TEAM_ID, assertAppleIdentityMatchesFirebaseUser(), createAppleClientSecret() (+5 more)

### Community 25 - "Schedule.jsx"
Cohesion: 0.21
Nodes (17): ImportScheduleModal(), AppBlur(), useRequiredScheduleContext(), useScheduleActions(), useScheduleData(), useScheduleSync(), MainLayout(), MainStack (+9 more)

### Community 26 - "ThemeSettings.jsx"
Cohesion: 0.37
Nodes (14): countLessons(), getArrayItemsFingerprint(), getAttachmentsFingerprint(), getFileLibraryFingerprint(), getGlobalFingerprint(), getLessonsFingerprint(), getNotificationPreferencesFingerprint(), getReminderFingerprint() (+6 more)

### Community 27 - "crashlytics.web.js"
Cohesion: 0.13
Nodes (15): date-fns, dotenv, expo-clipboard, @gorhom/bottom-sheet, dependencies, date-fns, dotenv, expo-clipboard (+7 more)

### Community 28 - "fix-build.js"
Cohesion: 0.20
Nodes (6): assert, babel, fs, Module, path, test

### Community 29 - "AdBanner.web.jsx"
Cohesion: 0.17
Nodes (16): getAndroidDownloadDirectoryUri(), getAttachmentUploadUserId(), getBlobFromUri(), getCacheBustedUrl(), getCachedAndroidDownloadDirectoryUri(), isRemoteUri(), isSafUri(), makeAttachmentError() (+8 more)

### Community 30 - "ExpandableCard.jsx"
Cohesion: 0.35
Nodes (8): consoleErrorReports, createSanitizedError(), initGlobalErrorHandling(), logCrashlyticsError(), logCrashlyticsMessage(), sanitizeText(), shouldReportConsoleError(), summarizeValue()

### Community 31 - "analytics.native.js"
Cohesion: 0.15
Nodes (13): deepClone(), LinkEditor(), styles, styles, TeacherEditor(), generateLocalId(), LessonEditor(), LessonEditorSubjectColorScreen() (+5 more)

### Community 32 - "date-fns"
Cohesion: 0.50
Nodes (4): AppSwitch(), getSize(), SIZES, styles

### Community 33 - "expo"
Cohesion: 0.19
Nodes (15): NotificationDrawerContext, NotificationDrawerProvider(), useNotificationDrawer(), useNotifications(), CARD_EXPAND_ANIMATION, configureCardLayoutAnimation(), interpolate(), NotificationInboxPanel() (+7 more)

### Community 34 - "expo-apple-authentication"
Cohesion: 0.28
Nodes (11): AccountDataDeletionError, collectStorageItems(), createStepError(), deleteAllUserCloudData(), deleteAttachmentStorage(), deleteOwnedShares(), deleteQueryInBatches(), deleteStorageItems() (+3 more)

### Community 35 - "expo-blur"
Cohesion: 0.29
Nodes (6): Build the Project Graph, Codex Integration, Graphify Setup, Install the CLI, Query the Graph, Team Notes

### Community 36 - "taskLessonLinking.js"
Cohesion: 0.28
Nodes (6): SettingsSelectionRow(), styles, LessonEditorPickerScreen(), styles, { width }, styles

### Community 38 - "expo-dev-client"
Cohesion: 0.26
Nodes (12): AttachmentImageLoadingOverlay(), DEFAULT_COLORS, getAttachmentAspectRatio(), getAttachmentPreview(), getContainedFrameStyle(), getStableImageKey(), getStableImageLoadKey(), getStableImageRevision() (+4 more)

### Community 39 - "expo-device"
Cohesion: 0.50
Nodes (3): distPath, fs, path

### Community 40 - "expo-document-picker"
Cohesion: 0.50
Nodes (3): Graphify, graphify, Project Instructions

### Community 45 - "expo-linking"
Cohesion: 0.42
Nodes (6): createDefaultGradient(), createDefaultLink(), createDefaultSubject(), createDefaultTeacher(), useEntityManager(), useUniqueId()

### Community 60 - "@react-native-assets/slider"
Cohesion: 0.44
Nodes (9): addScheduleRecordToMap(), ARRAY_FIELDS, chooseStartingWeek(), getArrayScore(), getCompletenessScore(), isValidDateValue(), isValidRepeatValue(), mergeScheduleRecords() (+1 more)

### Community 67 - "@react-native-firebase/analytics"
Cohesion: 0.20
Nodes (7): assert, babel, fs, Module, path, servicePath, test

### Community 69 - "@react-native-firebase/crashlytics"
Cohesion: 0.20
Nodes (7): assert, babel, fs, Module, path, servicePath, test

### Community 112 - "Account deletion deployment"
Cohesion: 0.40
Nodes (4): Account deletion deployment, Apple secret values, Required deployment order, Verification checklist

### Community 113 - "date-fns"
Cohesion: 0.10
Nodes (36): NOTIFICATION_TYPE_CONFIG, getTypeIcon(), NotificationsScreen(), styles, buildAccountLoginContent(), buildLessonReminderRequests(), buildNotificationIdentifier(), cancelLessonRemindersForSchedule() (+28 more)

### Community 114 - "DeviceManagement.jsx"
Cohesion: 0.24
Nodes (16): db, DeviceManager(), styles, createLoginNotification(), getCurrentDevicePushRegistration(), getUserNotificationContext(), syncDevicePushRegistration(), getDeviceId() (+8 more)

## Knowledge Gaps
- **299 isolated node(s):** `versionParts`, `name`, `version`, `private`, `type` (+294 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `crashlytics.web.js` to `MigrationModal.jsx`, `MorphingLoader.jsx`, `expo-localization`, `@expo/metro-runtime`, `@expo/ngrok`, `expo-notifications`, `expo-sharing`, `expo-splash-screen`, `expo-status-bar`, `expo-updates`, `firebase`, `phosphor-react-native`, `react-datepicker`, `react-dom`, `react-native`, `react-native-android-widget`, `@react-native-async-storage/async-storage`, `@react-native-community/blur`, `@react-native-community/datetimepicker`, `@react-native-community/netinfo`, `react-native-date-picker`, `react-native-device-info`, `@react-native-firebase/app`, `react-native-gesture-handler`, `react-native-get-random-values`, `react-native-google-mobile-ads`, `react-native-pager-view`, `@react-native-picker/picker`, `react-native-reanimated`, `scheduleDocumentCodec.js`, `react-native-screens`, `react-native-svg`, `react-native-vector-icons`, `react-native-web`, `react-native-worklets`, `react-native-worklets-core`, `@react-navigation/bottom-tabs`, `firestore.js`, `@react-navigation/native`, `uuid`, `adInit.native.js`, `adInit.web.js`, `babel.config.js`, `build-aab.ps1`, `build-android.ps1`, `build-dev.ps1`, `graphify.ps1`, `AndroidPagerView.android.js`, `encodedStoragePrefix`, `haptics.js`, `widgetTask.js`, `ScheduleProvider`, `Graphify Setup`, `Project Instructions`, `react-native-gesture-handler`, `@react-navigation/stack`, `@expo/metro-runtime`?**
  _High betweenness centrality (0.241) - this node is a cross-community bridge._
- **Why does `react` connect `MigrationModal.jsx` to `crashlytics.web.js`?**
  _High betweenness centrality (0.223) - this node is a cross-community bridge._
- **Why does `ScheduleEditorScreen()` connect `MigrationModal.jsx` to `Tasks.jsx`, `t`, `AuthScreen.jsx`, `FileLibraryScreen.jsx`, `NavigationSettings.jsx`, `date-fns`, `Schedule.jsx`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `t()` (e.g. with `OnboardingWizard()` and `ScheduleEditorScreen()`) actually correct?**
  _`t()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `versionParts`, `name`, `version` to the rest of the system?**
  _299 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MigrationModal.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11614401858304298 - nodes in this community are weakly interconnected._
- **Should `notificationService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08078231292517007 - nodes in this community are weakly interconnected._