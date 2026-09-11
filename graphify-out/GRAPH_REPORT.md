# Graph Report - PlanIt  (2026-09-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1769 nodes · 4948 edges · 97 communities (76 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b1f350dc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ScheduleProvider.jsx
- scheduleValidation.js
- src/index.js
- widgetCore.js
- attachmentService.js
- dependencies
- t
- FileLibraryScreen.jsx
- scripts
- DeleteAccountScreen.jsx
- notificationService.js
- LessonEditor.jsx
- gradientColors.test.cjs
- package.json
- TabNavigator.jsx
- react-native
- taskLessonLinking.js
- react
- themes.js
- Tasks.jsx
- generate-legal-documents.js
- deviceService.js
- TaskEditor.jsx
- MorphingLoader.jsx
- OnboardingWizard.jsx
- passwordResetService.js
- ensureLocalAttachment
- uploadAttachmentDraft
- nativeModuleGuards.test.cjs
- i18n.js
- LessonCard.jsx
- Root.jsx
- AuthScreen.jsx
- NotificationsScreen.jsx
- GradientScreen.jsx
- Schedule.jsx
- AttachmentImagePreview.jsx
- makeAttachmentError
- scheduleSync.test.cjs
- deviceNotificationData.test.cjs
- withAndroidPlayCompliance.js
- AdBannerImpl.jsx
- generate-legal-loading-documents.js
- haptics.js
- BreakCard.jsx
- StagedAttachmentImage.jsx
- cookieConsentService.web.js
- gradientColors.js
- withWidgetUpdateScheduler.js
- LegalDocumentScreen.jsx
- shareService.js
- GradientBackground.jsx
- crashlytics.native.js
- adMobCompliance.test.cjs
- firestoreSync.test.cjs
- localStorageDurability.test.cjs
- widgetCore.test.cjs
- app.config.js
- @babel/core
- accountDeletionAuth.test.cjs
- accountDeletionService.test.cjs
- cookieConsent.test.cjs
- scheduleContactValidation.test.cjs
- analytics.web.js
- adInit.native.js
- scheduleRecordMerge.js
- contactData.test.cjs
- passwordPolicy.test.cjs
- passwordResetService.test.cjs
- Graphify Setup
- metro.config.js
- NotificationInboxPanel.jsx
- passwordActionEmailSecurity.test.js
- Account deletion deployment
- AdsContext.native.jsx
- AdsContext.web.jsx
- fix-build.js
- adInit.web.js
- Project Instructions
- devDependencies
- Group.jsx
- SettingRow.jsx
- ChangeNameScreen.jsx
- overrides
- react-native-pager-view

## God Nodes (most connected - your core abstractions)
1. `t()` - 127 edges
2. `useScheduleData()` - 103 edges
3. `triggerHaptic()` - 89 edges
4. `react-native` - 73 edges
5. `react` - 73 edges
6. `useScheduleActions()` - 42 edges
7. `ScheduleProvider()` - 41 edges
8. `phosphor-react-native` - 41 edges
9. `scripts` - 40 edges
10. `FileLibraryScreen()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `ScheduleProvider()` --indirect_call--> `generateId()`  [INFERRED]
  src/context/ScheduleProvider.jsx → src/utils/idGenerator.js
- `TabItem()` --calls--> `triggerHaptic()`  [EXTRACTED]
  src/navigation/PlanItTabBar.jsx → src/utils/haptics.js
- `AnimatedGradientBackground()` --calls--> `useReducedMotionPreference()`  [EXTRACTED]
  src/auth/AuthScreen.jsx → src/hooks/useReducedMotionPreference.js
- `AnimatedIconSlot()` --calls--> `useReducedMotionPreference()`  [EXTRACTED]
  src/auth/AuthScreen.jsx → src/hooks/useReducedMotionPreference.js
- `ScaleTouchable()` --calls--> `useReducedMotionPreference()`  [EXTRACTED]
  src/pages/Schedule/components/Header.jsx → src/hooks/useReducedMotionPreference.js

## Import Cycles
- None detected.

## Communities (97 total, 9 thin omitted)

### Community 0 - "ScheduleProvider.jsx"
Cohesion: 0.06
Nodes (88): MigrationModal(), styles, SheetFlatList, createDefaultData(), cleanupStateByUser, commitCloudEntity(), createMissingGlobalData(), deleteUserSchedule() (+80 more)

### Community 1 - "scheduleValidation.js"
Cohesion: 0.07
Nodes (84): CONTACT_COLOR_OPTIONS, CONTACT_ICON_OPTIONS, getContactIconComponent(), getLinkIconComponent(), getLinkTypeMeta(), getTeacherContactTypeMeta(), ICONS, LINK_TYPES (+76 more)

### Community 2 - "src/index.js"
Cohesion: 0.06
Nodes (51): dependencies, firebase-admin, firebase-functions, @google-cloud/firestore, jose, nodemailer, engines, node (+43 more)

### Community 3 - "widgetCore.js"
Cohesion: 0.08
Nodes (48): expo-linking, react-native-android-widget, clearAllLocalAttachmentCaches(), clearLocalAccountData(), LOCAL_ACCOUNT_KEYS, clearAllLocalNotifications(), clearLocalSchedule(), createBoundaryTimestamp() (+40 more)

### Community 4 - "attachmentService.js"
Cohesion: 0.07
Nodes (54): storageBucketName, CACHE_FRESH_STATUSES, canUseCachedAttachment(), componentToHex(), COMPRESSIBLE_IMAGE_MIME_TYPES, compressNativeImageAttachment(), compressWebImageAttachment(), createNativeAttachmentImagePreview() (+46 more)

### Community 5 - "dependencies"
Cohesion: 0.04
Nodes (50): dependencies, expo, expo-apple-authentication, expo-blur, expo-build-properties, expo-clipboard, expo-constants, expo-crypto (+42 more)

### Community 6 - "t"
Cohesion: 0.10
Nodes (44): InputField(), TermsCheckbox(), WelcomeContent(), useCalendarLogic(), ImportScheduleModal(), ShareScheduleModal(), SettingsSelectionRow(), useRequiredScheduleContext() (+36 more)

### Community 7 - "FileLibraryScreen.jsx"
Cohesion: 0.12
Nodes (45): AttachmentManager(), getAttachmentKindIcon(), interpolate(), styles, AttachmentImagePreviewContext, AttachmentImagePreviewProvider(), useAttachmentImagePreview(), useOptionalDaySchedule() (+37 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (40): scripts, android, build:aab, build:apk, build:dev, build:test-apk, dev, dev-start (+32 more)

### Community 9 - "DeleteAccountScreen.jsx"
Cohesion: 0.11
Nodes (36): expo-apple-authentication, @react-native-google-signin/google-signin, ACCOUNT_REAUTH_MAX_AGE_MS, createAppleSignInNonce(), createAuthFlowError(), getAccountDeletionProviders(), getLinkedProviders(), isAccountDeletionVerificationValid() (+28 more)

### Community 10 - "notificationService.js"
Cohesion: 0.11
Nodes (34): useNotifications(), boundedText(), buildAccountLoginContent(), buildLessonReminderRequests(), buildNotificationIdentifier(), CHANNELS_BY_TYPE, cleanupExpiredNotifications(), configuredChannels (+26 more)

### Community 11 - "LessonEditor.jsx"
Cohesion: 0.13
Nodes (31): AdvancedColorPicker(), SUBJECT_ICONS, DayScheduleContext, DayScheduleProvider(), canUseLayoutAnimation(), deepClone(), generateLocalId(), getInitialEditorRoute() (+23 more)

### Community 12 - "gradientColors.test.cjs"
Cohesion: 0.07
Nodes (35): advancedColorPickerPath, angles, assert, authScreenPath, babel, breakCardPath, colors, fs (+27 more)

### Community 13 - "package.json"
Cohesion: 0.06
Nodes (33): main, name, private, version, cross-env, expo-blur, expo-build-properties, expo-clipboard (+25 more)

### Community 14 - "TabNavigator.jsx"
Cohesion: 0.10
Nodes (25): NotificationDrawerContext, NotificationDrawerProvider(), CUSTOM_NAVIGATION_STYLE_KEYS, getAvailableNavigationStyleKeys(), getIOSMajorVersion(), isExpoGo(), isLiquidGlassNavigationSupported(), LIQUID_GLASS_NAVIGATION_STYLE (+17 more)

### Community 15 - "react-native"
Cohesion: 0.13
Nodes (21): react-native, CalendarGrid(), DayCell, sameDay(), styles, styles, styles, AppSwitch() (+13 more)

### Community 16 - "taskLessonLinking.js"
Cohesion: 0.17
Nodes (30): formatOccurrenceWeekLabel(), getOccurrenceEndTime(), groupOccurrencesByDay(), LessonOccurrenceScreen(), areLessonRefsSame(), buildTaskLessonOptions(), createLessonRefForDate(), createLessonRefFromOccurrence() (+22 more)

### Community 17 - "react"
Cohesion: 0.14
Nodes (15): expo-constants, phosphor-react-native, react, @react-navigation/native, styles, styles, MorphingLoader(), styles (+7 more)

### Community 18 - "themes.js"
Cohesion: 0.10
Nodes (15): react-native-reanimated, @react-navigation/native-stack, AppBlur(), styles, themes, MainStack, styles, styles (+7 more)

### Community 19 - "Tasks.jsx"
Cohesion: 0.11
Nodes (28): tinycolor2, AnimatedTouchableOpacity, areSameIds(), buildTaskListRows(), compareTaskScheduleNames(), formatPendingTaskCountLabel(), formatTaskCardDate(), formatTaskCountLabel() (+20 more)

### Community 20 - "generate-legal-documents.js"
Cohesion: 0.13
Nodes (29): assertWebsiteDocumentsCurrent(), browserUrlsFor(), buildGeneratedSource(), decodeEntities(), DEFAULT_SOURCE_DIR, DOCUMENTS, ensureDirectoryFor(), extractMetadata() (+21 more)

### Community 21 - "deviceService.js"
Cohesion: 0.13
Nodes (27): @react-native-async-storage/async-storage, db, DeviceManager(), handleRemoveAllOthers(), handleRemoveDevice(), renderDevice(), timestampToMs(), getUserNotificationContext() (+19 more)

### Community 22 - "TaskEditor.jsx"
Cohesion: 0.16
Nodes (27): ScheduleSwitcher(), buildDateOnlyLessonRef(), buildTaskEditorSessionKey(), colorWithAlpha(), deepCloneArray(), formatOccurrenceCount(), getGroupSubtitle(), getGroupTitle() (+19 more)

### Community 23 - "MorphingLoader.jsx"
Cohesion: 0.12
Nodes (21): ANGLE_OPTIONS, buildPath(), clamp01(), clockwiseLerpAngle(), createFrameQueue(), createRandomFrame(), createRenderState(), ensureFrameQueue() (+13 more)

### Community 24 - "OnboardingWizard.jsx"
Cohesion: 0.16
Nodes (21): @react-native-community/datetimepicker, defaultSchedule, AnimatedTouchableOpacity, expandFirstOutputRange(), ICONS, INITIAL_STEP_HEIGHTS, SCHEDULE_COLOR_KEYS, STEP_INDICES (+13 more)

### Community 25 - "passwordResetService.js"
Cohesion: 0.15
Nodes (22): createPasswordActionError(), createPasswordResetNavigationUrl(), findPasswordResetRequest(), getAddPasswordEmailEndpoint(), getConfiguredActionUrl(), getPasswordResetActionCodeSettings(), hasPasswordProvider(), NESTED_LINK_PARAMS (+14 more)

### Community 26 - "ensureLocalAttachment"
Cohesion: 0.24
Nodes (24): cacheAttachmentFromLocalUri(), canUseNativeAttachmentCache(), canUseWebAttachmentCache(), deleteLocalAttachmentCache(), deleteWebAttachmentCacheRecord(), ensureDirectory(), ensureLocalAttachment(), getAttachmentCacheDirectory() (+16 more)

### Community 27 - "uploadAttachmentDraft"
Cohesion: 0.16
Nodes (24): createAndroidDownloadFile(), createDraftAttachment(), getAndroidDownloadFileName(), getAssetFile(), getAssetName(), getAssetSize(), getAttachmentContentDisposition(), getAttachmentUploadUserId() (+16 more)

### Community 28 - "nativeModuleGuards.test.cjs"
Cohesion: 0.10
Nodes (21): appBlurPath, assert, attachmentPreviewCallSitePaths, attachmentPreviewContextPath, babel, bottomSheetPath, fs, loadNavigationMetrics() (+13 more)

### Community 29 - "i18n.js"
Cohesion: 0.14
Nodes (13): @gorhom/bottom-sheet, react-native-safe-area-context, styles, HUE_COLORS, styles, BottomSheet, DEFAULT_SNAP_POINTS, SheetScrollView (+5 more)

### Community 30 - "LessonCard.jsx"
Cohesion: 0.18
Nodes (18): getIconComponent(), ICON_CATEGORIES, ActiveHighlight, BackgroundPattern, cachedPatternPositions, getPatternPositions(), getTimerState(), LessonCardPure (+10 more)

### Community 31 - "Root.jsx"
Cohesion: 0.15
Nodes (11): getStyles(), PasswordResetScreen(), GlobalShareHandler(), EditorContext, EditorProvider(), AppDarkTheme, linking, RootApp() (+3 more)

### Community 32 - "AuthScreen.jsx"
Cohesion: 0.19
Nodes (14): AnimatedGradientBackground(), AnimatedIconSlot(), AUTH_LAYOUT_ANIMATION, AuthScreen(), configureAuthLayoutAnimation(), getIconConfig(), styles, PasswordStrengthBar() (+6 more)

### Community 33 - "NotificationsScreen.jsx"
Cohesion: 0.17
Nodes (17): SettingsGroup(), NOTIFICATION_TYPE_CONFIG, getTypeIcon(), NotificationsScreen(), styles, cancelLessonRemindersForSchedule(), createNotificationPreferencesWithPush(), dispatchLocalPushNotification() (+9 more)

### Community 34 - "GradientScreen.jsx"
Cohesion: 0.24
Nodes (17): AngleSlider(), HUE_COLORS, InlineColorPicker(), styles, applySoftCardinalMagnet(), CARDINAL_GRADIENT_ANGLES, clamp(), clampGradientSliderAngle() (+9 more)

### Community 35 - "Schedule.jsx"
Cohesion: 0.20
Nodes (15): getAppHeaderHeight(), getAppHeaderTopInset(), useDaySchedule(), useNotificationDrawer(), DaySchedule(), styles, Header(), isSameDay() (+7 more)

### Community 36 - "AttachmentImagePreview.jsx"
Cohesion: 0.20
Nodes (15): react-native-gesture-handler, AttachmentImagePreview(), clampIndex(), dedupeImageAttachments(), GALLERY_SPRING, getAttachmentIdentity(), getAttachmentLoadKey(), getAttachmentPreviewUri() (+7 more)

### Community 37 - "makeAttachmentError"
Cohesion: 0.18
Nodes (17): getAndroidDownloadDirectoryUri(), getBlobFromUri(), getCacheBustedUrl(), getCachedAndroidDownloadDirectoryUri(), getFreshAttachmentDownloadURL(), isRemoteUri(), isSafUri(), makeAttachmentError() (+9 more)

### Community 38 - "scheduleSync.test.cjs"
Cohesion: 0.12
Nodes (14): assert, babel, compileModule(), createDefaultDataPath, fingerprint, fingerprintPath, fs, Module (+6 more)

### Community 39 - "deviceNotificationData.test.cjs"
Cohesion: 0.15
Nodes (9): assert, babel, compileWithMocks(), FakeTimestamp, fs, loadNotificationService(), Module, path (+1 more)

### Community 40 - "withAndroidPlayCompliance.js"
Cohesion: 0.19
Nodes (12): {

  AndroidConfig,

  withAndroidManifest,

  withAppBuildGradle,

  withFinalizedMod,

  withGradleProperties,

}, fs, patchAppBuildGradle(), path, removeGeneratedBlock(), upsertGradleProperty(), withAndroidPlayCompliance(), assert (+4 more)

### Community 41 - "AdBannerImpl.jsx"
Cohesion: 0.16
Nodes (10): expo, react-native-google-mobile-ads, AdBanner(), isExpoGo, styles, styles, AD_UNITS, GOOGLE_DEMO_BANNER_IDS (+2 more)

### Community 42 - "generate-legal-loading-documents.js"
Cohesion: 0.22
Nodes (13): cleanLoadingTag(), DOCUMENTS, extractDocumentBody(), fs, generateLoadingMdxBody(), getLineCount(), getRoleClass(), getWidthClass() (+5 more)

### Community 43 - "haptics.js"
Cohesion: 0.19
Nodes (7): SettingsActionRow(), styles, styles, storageOperationQueue, styles, HAPTIC_EVENTS, lastFeedbackAt

### Community 44 - "BreakCard.jsx"
Cohesion: 0.24
Nodes (12): createNowTickStore(), isTimerRelevantDate(), NowTickContext, NowTickProvider(), startOfDay(), useNowTick(), AnimatedBreakCard, BreakCard() (+4 more)

### Community 45 - "StagedAttachmentImage.jsx"
Cohesion: 0.26
Nodes (12): AttachmentImageLoadingOverlay(), DEFAULT_COLORS, getAttachmentAspectRatio(), getAttachmentPreview(), getContainedFrameStyle(), getStableImageKey(), getStableImageLoadKey(), getStableImageRevision() (+4 more)

### Community 46 - "cookieConsentService.web.js"
Cohesion: 0.45
Nodes (12): clearConsentExpiryTimer(), createBrowserEvent(), dispatchConsentChange(), getBrowserWindow(), isConsentStatus(), readCookieConsent(), removeStoredConsent(), requestCookiePreferences() (+4 more)

### Community 47 - "gradientColors.js"
Cohesion: 0.31
Nodes (12): clampLocation(), createPerceptualGradientStops(), getContrastSamples(), getRawStops(), interpolateGradientColor(), interpolatePerceptualColor(), linearChannelToSrgb(), normalizeGradientStops() (+4 more)

### Community 48 - "withWidgetUpdateScheduler.js"
Cohesion: 0.24
Nodes (11): addUnique(), coreProviderSource(), fs, moduleSource(), packageSource(), path, PERMISSIONS, schedulerSource() (+3 more)

### Community 49 - "LegalDocumentScreen.jsx"
Cohesion: 0.29
Nodes (8): CookieConsentBanner(), styles, getLegalDocument(), LEGAL_DOCUMENT_TYPES, LEGAL_DOCUMENTS, styles, getLegalDocumentBrowserUrl(), getLegalDocumentLocale()

### Community 50 - "shareService.js"
Cohesion: 0.29
Nodes (10): expo-crypto, SharedSchedulesManager(), createSharedSchedule(), createSharedScheduleLink(), deleteSharedSchedule(), fetchSharedSchedule(), generateShareCode(), getUserSharedSchedules() (+2 more)

### Community 51 - "GradientBackground.jsx"
Cohesion: 0.38
Nodes (10): createGradientDefinition(), formatStopPosition(), getGradientAngleFromPoints(), getGradientBackgroundStyle(), getGradientSurfaceStyle(), getPointValue(), GradientBackground, normalizeAngle() (+2 more)

### Community 52 - "crashlytics.native.js"
Cohesion: 0.35
Nodes (8): consoleErrorReports, createSanitizedError(), initGlobalErrorHandling(), logCrashlyticsError(), logCrashlyticsMessage(), sanitizeText(), shouldReportConsoleError(), summarizeValue()

### Community 53 - "adMobCompliance.test.cjs"
Cohesion: 0.22
Nodes (10): adConfigPath, assert, babel, fs, loadAdConfig(), loadAdService(), Module, path (+2 more)

### Community 54 - "firestoreSync.test.cjs"
Cohesion: 0.20
Nodes (8): assert, babel, firestorePath, fs, loadFirestore(), Module, path, test

### Community 55 - "localStorageDurability.test.cjs"
Cohesion: 0.22
Nodes (8): assert, babel, compileModule(), fs, loadStorageModule(), Module, path, test

### Community 56 - "widgetCore.test.cjs"
Cohesion: 0.20
Nodes (9): assert, babel, compileCommonJsModule(), fs, Module, path, scheduleCore, scheduleCorePath (+1 more)

### Community 57 - "app.config.js"
Cohesion: 0.20
Nodes (7): androidAdMobAppId, firebaseAuthLinkHost, firebaseProjectId, googleDemoAppIds, iosAdMobAppId, shareLinkHost, versionParts

### Community 58 - "@babel/core"
Cohesion: 0.22
Nodes (9): @babel/core, assert, babel, compileModule(), fs, Module, ownership, path (+1 more)

### Community 59 - "accountDeletionAuth.test.cjs"
Cohesion: 0.22
Nodes (8): assert, babel, fs, loadAuthService(), Module, path, servicePath, test

### Community 60 - "accountDeletionService.test.cjs"
Cohesion: 0.22
Nodes (8): assert, babel, fs, loadService(), Module, path, servicePath, test

### Community 61 - "cookieConsent.test.cjs"
Cohesion: 0.22
Nodes (7): assert, babel, compileCommonJsModule(), fs, Module, path, test

### Community 62 - "scheduleContactValidation.test.cjs"
Cohesion: 0.20
Nodes (9): assert, babel, baseSchedule, fs, Module, path, { sanitizeSharedSchedule }, srcRoot (+1 more)

### Community 63 - "analytics.web.js"
Cohesion: 0.25
Nodes (5): app, deleteAnalyticsCookies(), DENIED_CONSENT, disableAnalytics(), GRANTED_ANALYTICS_CONSENT

### Community 64 - "adInit.native.js"
Cohesion: 0.39
Nodes (8): EMPTY_STATE, getConsentFallback(), initAds(), isExpoGo, loadGoogleMobileAds(), normalizeConsentState(), showAdPrivacyOptions(), startMobileAds()

### Community 65 - "scheduleRecordMerge.js"
Cohesion: 0.50
Nodes (8): ARRAY_FIELDS, chooseStartingWeek(), getArrayScore(), getCompletenessScore(), isValidDateValue(), isValidRepeatValue(), mergeScheduleRecords(), withStartingWeekFallback()

### Community 66 - "contactData.test.cjs"
Cohesion: 0.25
Nodes (8): assert, babel, compileModule(), contacts, fs, Module, path, test

### Community 67 - "passwordPolicy.test.cjs"
Cohesion: 0.22
Nodes (7): assert, babel, fs, Module, modulePath, path, test

### Community 68 - "passwordResetService.test.cjs"
Cohesion: 0.25
Nodes (8): assert, babel, fs, loadPasswordResetService(), Module, path, servicePath, test

### Community 69 - "Graphify Setup"
Cohesion: 0.29
Nodes (6): Build the Project Graph, Codex Integration, Graphify Setup, Install the CLI, Query the Graph, Team Notes

### Community 70 - "metro.config.js"
Cohesion: 0.33
Nodes (6): config, escapeForRegex(), { getDefaultConfig }, localOnlyBlockList, localOnlyFolders, path

### Community 71 - "NotificationInboxPanel.jsx"
Cohesion: 0.43
Nodes (6): CARD_EXPAND_ANIMATION, configureCardLayoutAnimation(), interpolate(), NotificationInboxPanel(), styles, timestampToMs()

### Community 72 - "passwordActionEmailSecurity.test.js"
Cohesion: 0.33
Nodes (5): handler, handlerEnd, handlerStart, source, testDirectory

### Community 75 - "Account deletion deployment"
Cohesion: 0.40
Nodes (4): Account deletion deployment, Apple secret values, Required deployment order, Verification checklist

### Community 78 - "fix-build.js"
Cohesion: 0.50
Nodes (3): distPath, fs, path

### Community 81 - "devDependencies"
Cohesion: 0.67
Nodes (3): devDependencies, @babel/core, cross-env

## Knowledge Gaps
- **522 isolated node(s):** `styles`, `cleanupStateByUser`, `ScheduleActionsContext`, `ScheduleContext`, `ScheduleDataContext` (+517 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 615 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@babel/core` connect `@babel/core` to `contactData.test.cjs`, `passwordResetService.test.cjs`, `scheduleSync.test.cjs`, `deviceNotificationData.test.cjs`, `gradientColors.test.cjs`, `package.json`, `nativeModuleGuards.test.cjs`, `adMobCompliance.test.cjs`, `firestoreSync.test.cjs`, `localStorageDurability.test.cjs`, `widgetCore.test.cjs`, `accountDeletionAuth.test.cjs`, `accountDeletionService.test.cjs`, `cookieConsent.test.cjs`, `scheduleContactValidation.test.cjs`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **Why does `react-native` connect `react-native` to `ScheduleProvider.jsx`, `scheduleValidation.js`, `widgetCore.js`, `attachmentService.js`, `t`, `FileLibraryScreen.jsx`, `DeleteAccountScreen.jsx`, `notificationService.js`, `LessonEditor.jsx`, `package.json`, `TabNavigator.jsx`, `react`, `themes.js`, `Tasks.jsx`, `deviceService.js`, `TaskEditor.jsx`, `MorphingLoader.jsx`, `OnboardingWizard.jsx`, `i18n.js`, `LessonCard.jsx`, `AuthScreen.jsx`, `GradientScreen.jsx`, `Schedule.jsx`, `AttachmentImagePreview.jsx`, `AdBannerImpl.jsx`, `haptics.js`, `BreakCard.jsx`, `StagedAttachmentImage.jsx`, `LegalDocumentScreen.jsx`, `GradientBackground.jsx`, `NotificationInboxPanel.jsx`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `ScheduleProvider.jsx`, `scheduleValidation.js`, `widgetCore.js`, `t`, `FileLibraryScreen.jsx`, `DeleteAccountScreen.jsx`, `LessonEditor.jsx`, `package.json`, `TabNavigator.jsx`, `react-native`, `themes.js`, `Tasks.jsx`, `TaskEditor.jsx`, `MorphingLoader.jsx`, `OnboardingWizard.jsx`, `i18n.js`, `LessonCard.jsx`, `Root.jsx`, `AuthScreen.jsx`, `GradientScreen.jsx`, `Schedule.jsx`, `AttachmentImagePreview.jsx`, `AdBannerImpl.jsx`, `haptics.js`, `BreakCard.jsx`, `StagedAttachmentImage.jsx`, `LegalDocumentScreen.jsx`, `GradientBackground.jsx`, `NotificationInboxPanel.jsx`, `AdsContext.native.jsx`, `AdsContext.web.jsx`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `styles`, `cleanupStateByUser`, `ScheduleActionsContext` to the rest of the system?**
  _522 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ScheduleProvider.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05586477015048444 - nodes in this community are weakly interconnected._
- **Should `scheduleValidation.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07000686341798215 - nodes in this community are weakly interconnected._
- **Should `src/index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05779220779220779 - nodes in this community are weakly interconnected._