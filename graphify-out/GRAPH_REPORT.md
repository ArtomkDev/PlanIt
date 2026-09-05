# Graph Report - .  (2026-08-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1613 nodes · 2870 edges · 169 communities (93 shown, 76 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1388ceda`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- notificationService.js
- widgetCore.js
- attachmentService.js
- TaskEditor.jsx
- taskLessonLinking.js
- LessonEditor.jsx
- AttachmentImagePreview.jsx
- scripts
- Tasks.jsx
- storage.js
- generate-legal-documents.js
- ensureLocalAttachment
- scheduleValidation.js
- src/index.js
- navigationMetrics.js
- makeAttachmentError
- functions/package.json
- firestore.js
- uploadAttachmentDraft
- scheduleSync.js
- passwordResetService.js
- MorphingLoader.jsx
- ScheduleProvider.jsx
- adInit.native.js
- useScheduleData
- useReducedMotionPreference
- OnboardingWizard.jsx
- scheduleSync.test.cjs
- SharedSchedulesManager.jsx
- LanguageSettings.jsx
- deviceNotificationData.test.cjs
- withAndroidPlayCompliance.js
- generate-legal-loading-documents.js
- authServices.js
- dependencies
- t
- accountDeletionService.js
- cookieConsentService.web.js
- withWidgetUpdateScheduler.js
- AuthScreen.jsx
- firestoreSync.test.cjs
- useEntityManager.js
- LessonCard.jsx
- FileLibraryScreen.jsx
- crashlytics.native.js
- reminderSettings.js
- adMobCompliance.test.cjs
- localStorageDurability.test.cjs
- nativeModuleGuards.test.cjs
- widgetCore.test.cjs
- scheduleRecordMerge.js
- accountDeletionAuth.test.cjs
- accountDeletionService.test.cjs
- cookieConsent.test.cjs
- app.config.js
- Header.jsx
- ColorScreen.jsx
- inferAttachmentMimeType
- passwordPolicy.test.cjs
- passwordResetService.test.cjs
- scheduleOwnership.test.cjs
- passwordPolicy.js
- MorphingLoader
- analytics.web.js
- Graphify Setup
- package.json
- useNowTick.js
- NotificationInboxPanel.jsx
- passwordActionEmailTemplates.js
- passwordActionEmailSecurity.test.js
- BottomSheet.jsx
- firebase.js
- BreakCard.jsx
- GradientScreen.jsx
- Schedule.jsx
- devDependencies
- Account deletion deployment
- AdsContext.native.jsx
- AdsContext.web.jsx
- AppContext.jsx
- DayScheduleProvider.jsx
- AccountSettings.jsx
- fix-build.js
- AdBanner.native.jsx
- legalDocuments.generated.js
- subjectIcons.js
- EditorProvider.jsx
- NotificationDrawerContext.js
- DeleteAccountScreen.jsx
- ResetDB.jsx
- TaskScheduleFilterSheet.jsx
- adInit.web.js
- Project Instructions
- ShareScheduleModal.jsx
- CookieConsentBanner.web.jsx
- ExpandableCard.jsx
- layoutMetrics.js
- InputScreen.jsx
- Group.jsx
- SettingRow.jsx
- AboutApp.jsx
- ChangeEmailScreen.jsx
- ChangeNameScreen.jsx
- ChangePasswordScreen.jsx
- LegalDocumentScreen.jsx
- SyncConflictScreen.jsx
- legalDocumentLinks.js
- scheduleDisplay.js
- expo-apple-authentication
- expo-build-properties
- expo-clipboard
- expo-crypto
- expo-dev-client
- expo-device
- expo-document-picker
- expo-file-system
- expo-haptics
- expo-image-picker
- expo-linear-gradient
- expo-linking
- expo-localization
- @expo/metro-runtime
- expo-sharing
- expo-splash-screen
- expo-status-bar
- expo-updates
- @gorhom/bottom-sheet
- phosphor-react-native
- react
- react-dom
- react-native
- react-native-android-widget
- @react-native-async-storage/async-storage
- @react-native-community/datetimepicker
- @react-native-community/netinfo
- @react-native-firebase/analytics
- @react-native-firebase/app
- @react-native-firebase/crashlytics
- react-native-gesture-handler
- react-native-google-mobile-ads
- @react-native-google-signin/google-signin
- react-native-pager-view
- react-native-reanimated
- react-native-safe-area-context
- react-native-screens
- react-native-svg
- react-native-web
- react-native-worklets
- @react-navigation/bottom-tabs
- @react-navigation/native
- @react-navigation/native-stack
- tinycolor2
- defaultSchedule.js
- ScheduleSyncConflictError
- getWidgetSelectedScheduleId

## God Nodes (most connected - your core abstractions)
1. `scripts` - 38 edges
2. `useScheduleData()` - 37 edges
3. `makeAttachmentError()` - 23 edges
4. `ensureLocalAttachment()` - 21 edges
5. `uploadAttachmentDraft()` - 19 edges
6. `sanitizeScheduleCore()` - 18 edges
7. `t()` - 17 edges
8. `useScheduleActions()` - 16 edges
9. `inferAttachmentMimeType()` - 15 edges
10. `AttachmentImagePreview()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `ImportScheduleModal()` --indirect_call--> `data()`  [INFERRED]
  src/components/modals/ImportScheduleModal.jsx → tests/scheduleSync.test.cjs
- `runDeviceSyncTimeAndCleanUp()` --indirect_call--> `data()`  [INFERRED]
  src/config/firestore.js → tests/scheduleSync.test.cjs
- `saveSchedule()` --indirect_call--> `schedule()`  [INFERRED]
  src/config/firestore.js → tests/scheduleSync.test.cjs
- `markScheduleDataDirty()` --indirect_call--> `schedule()`  [INFERRED]
  src/utils/scheduleSync.js → tests/scheduleSync.test.cjs
- `loadNotificationService()` --indirect_call--> `data()`  [INFERRED]
  tests/deviceNotificationData.test.cjs → tests/scheduleSync.test.cjs

## Import Cycles
- None detected.

## Communities (169 total, 76 thin omitted)

### Community 0 - "notificationService.js"
Cohesion: 0.06
Nodes (73): SettingsGroup(), styles, NOTIFICATION_TYPE_CONFIG, useNotifications(), DeviceManager(), styles, timestampToMs(), getTypeIcon() (+65 more)

### Community 1 - "widgetCore.js"
Cohesion: 0.07
Nodes (49): App(), GlobalShareHandler(), AppDarkTheme, linking, RootApp(), Stack, clearLocalAccountData(), LOCAL_ACCOUNT_KEYS (+41 more)

### Community 2 - "attachmentService.js"
Cohesion: 0.07
Nodes (52): CACHE_FRESH_STATUSES, canUseCachedAttachment(), componentToHex(), COMPRESSIBLE_IMAGE_MIME_TYPES, compressNativeImageAttachment(), compressWebImageAttachment(), createNativeAttachmentImagePreview(), createNativeCompressedImageCandidate() (+44 more)

### Community 3 - "TaskEditor.jsx"
Cohesion: 0.07
Nodes (39): AttachmentManager(), getAttachmentKindIcon(), interpolate(), styles, CalendarGrid(), DayCell, styles, CalendarSheet() (+31 more)

### Community 4 - "taskLessonLinking.js"
Cohesion: 0.11
Nodes (46): addMinutes(), buildLessonOccurrences(), buildLessonTimes(), calculateScheduleWeek(), createDateAtTime(), formatMinutesToTime(), getBreakDuration(), getDurationMinutes() (+38 more)

### Community 5 - "LessonEditor.jsx"
Cohesion: 0.11
Nodes (37): SettingsRow(), styles, getLinkTypeMeta(), getTeacherContactTypeMeta(), ICONS, LINK_TYPES, TEACHER_CONTACT_TYPES, deepClone() (+29 more)

### Community 6 - "AttachmentImagePreview.jsx"
Cohesion: 0.08
Nodes (32): AttachmentImagePreview(), clampIndex(), dedupeImageAttachments(), GALLERY_SPRING, getAttachmentIdentity(), getAttachmentLoadKey(), getAttachmentPreviewUri(), getAttachmentRenderRevision() (+24 more)

### Community 7 - "scripts"
Cohesion: 0.05
Nodes (38): scripts, android, build:aab, build:apk, build:dev, build:test-apk, dev, dev-start (+30 more)

### Community 8 - "Tasks.jsx"
Cohesion: 0.10
Nodes (32): AnimatedTouchableOpacity, areSameIds(), buildTaskListRows(), compareTaskScheduleNames(), formatPendingTaskCountLabel(), formatTaskCardDate(), formatTaskCountLabel(), formatTasksHeaderSummary() (+24 more)

### Community 9 - "storage.js"
Cohesion: 0.15
Nodes (30): MigrationModal(), styles, useAppLanguage(), ScheduleSwitcher(), storageOperationQueue, styles, SUPPORTED_LANGUAGES, clearCloudMigrationFlag() (+22 more)

### Community 10 - "generate-legal-documents.js"
Cohesion: 0.13
Nodes (29): assertWebsiteDocumentsCurrent(), browserUrlsFor(), buildGeneratedSource(), decodeEntities(), DEFAULT_SOURCE_DIR, DOCUMENTS, ensureDirectoryFor(), extractMetadata() (+21 more)

### Community 11 - "ensureLocalAttachment"
Cohesion: 0.19
Nodes (29): cacheAttachmentFromLocalUri(), canUseNativeAttachmentCache(), canUseWebAttachmentCache(), clearAllLocalAttachmentCaches(), deleteLocalAttachmentCache(), deleteWebAttachmentCacheRecord(), ensureDirectory(), ensureLocalAttachment() (+21 more)

### Community 12 - "scheduleValidation.js"
Cohesion: 0.25
Nodes (29): assertImportShape(), clampNumber(), cleanColor(), cleanContactType(), cleanContactUrl(), cleanId(), cleanIdArray(), cleanIsoDate() (+21 more)

### Community 13 - "src/index.js"
Cohesion: 0.11
Nodes (26): APPLE_CLIENT_ID, APPLE_JWKS, APPLE_KEY_ID, APPLE_KEYS_URL, APPLE_PRIVATE_KEY, APPLE_TEAM_ID, assertAppleIdentityMatchesFirebaseUser(), buildPasswordActionLink() (+18 more)

### Community 14 - "navigationMetrics.js"
Cohesion: 0.13
Nodes (18): CUSTOM_NAVIGATION_STYLE_KEYS, getAvailableNavigationStyleKeys(), getIOSMajorVersion(), isExpoGo(), isLiquidGlassNavigationSupported(), NAVIGATION_METRICS, NAVIGATION_STYLE_KEYS, resolveNavigationStyle() (+10 more)

### Community 15 - "makeAttachmentError"
Cohesion: 0.18
Nodes (17): buildAttachmentPickResultFromWebFiles(), buildPickResult(), captureAttachmentPhoto(), getAndroidDownloadDirectoryUri(), getBlobFromUri(), getCachedAndroidDownloadDirectoryUri(), isRemoteUri(), isSafUri() (+9 more)

### Community 16 - "functions/package.json"
Cohesion: 0.09
Nodes (21): firebase-admin, firebase-functions, dependencies, firebase-admin, firebase-functions, @google-cloud/firestore, jose, nodemailer (+13 more)

### Community 17 - "firestore.js"
Cohesion: 0.20
Nodes (21): beginAccountDeletion(), cleanupStateByUser, commitCloudEntity(), createMissingGlobalData(), deleteAllUserData(), deleteUserSchedule(), ensureVersioning(), fromCloudDocument() (+13 more)

### Community 18 - "uploadAttachmentDraft"
Cohesion: 0.12
Nodes (27): createAttachmentReference(), deleteLocalAttachmentCaches(), deleteStoredAttachment(), deleteStoredAttachments(), getAttachmentContentDisposition(), getAttachmentFileId(), getAttachmentLibraryMap(), getAttachmentLibraryUsage() (+19 more)

### Community 19 - "scheduleSync.js"
Cohesion: 0.20
Nodes (19): getScheduleDataFingerprint(), hasScheduleDataChanged(), normalizeForFingerprint(), normalizeScheduleData(), contentChanged(), getBaseVersion(), getCleanDivergenceReason(), getVersion() (+11 more)

### Community 20 - "passwordResetService.js"
Cohesion: 0.18
Nodes (18): createPasswordActionError(), createPasswordResetNavigationUrl(), findPasswordResetRequest(), getAddPasswordEmailEndpoint(), getConfiguredActionUrl(), getPasswordResetActionCodeSettings(), hasPasswordProvider(), NESTED_LINK_PARAMS (+10 more)

### Community 21 - "MorphingLoader.jsx"
Cohesion: 0.17
Nodes (18): ANGLE_OPTIONS, buildPath(), clamp01(), clockwiseLerpAngle(), createRandomFrame(), createRenderState(), ensureFrameQueue(), gradientVector() (+10 more)

### Community 22 - "ScheduleProvider.jsx"
Cohesion: 0.16
Nodes (18): createDefaultData(), applyCommittedSync(), getActiveScheduleFromData(), hasDirtyScheduleData(), isSameGlobalDraft(), logSyncDiagnostic(), mergeCommittedEntity(), ScheduleActionsContext (+10 more)

### Community 23 - "adInit.native.js"
Cohesion: 0.18
Nodes (13): styles, AD_UNITS, GOOGLE_DEMO_BANNER_IDS, productionBannerId, testBannerId, EMPTY_STATE, getConsentFallback(), initAds() (+5 more)

### Community 24 - "useScheduleData"
Cohesion: 0.19
Nodes (13): AppBlur(), useScheduleData(), useScheduleLayout(), DRAWER_MOTION_EASING, DRAWER_VISUAL_EASING, getNativeTabIcon(), SettingsStack(), Stack (+5 more)

### Community 25 - "useReducedMotionPreference"
Cohesion: 0.18
Nodes (12): AppSwitch(), getSize(), SIZES, styles, styles, TabSwitcher(), getWebPreference(), useReducedMotionPreference() (+4 more)

### Community 26 - "OnboardingWizard.jsx"
Cohesion: 0.16
Nodes (12): SettingsActionRow(), styles, MainStack, styles, AnimatedTouchableOpacity, expandFirstOutputRange(), ICONS, INITIAL_STEP_HEIGHTS (+4 more)

### Community 27 - "scheduleSync.test.cjs"
Cohesion: 0.12
Nodes (14): assert, babel, createDefaultDataPath, fingerprint, fingerprintPath, fs, Module, path (+6 more)

### Community 28 - "SharedSchedulesManager.jsx"
Cohesion: 0.23
Nodes (11): ImportScheduleModal(), styles, SharedSchedulesManager(), styles, createSharedSchedule(), deleteSharedSchedule(), fetchSharedSchedule(), generateShareCode() (+3 more)

### Community 29 - "LanguageSettings.jsx"
Cohesion: 0.20
Nodes (6): SettingsSelectionRow(), styles, themes, SettingsScreenLayout(), styles, styles

### Community 30 - "deviceNotificationData.test.cjs"
Cohesion: 0.15
Nodes (9): assert, babel, compileWithMocks(), FakeTimestamp, fs, loadNotificationService(), Module, path (+1 more)

### Community 31 - "withAndroidPlayCompliance.js"
Cohesion: 0.19
Nodes (12): {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withFinalizedMod,
  withGradleProperties,
}, fs, patchAppBuildGradle(), path, removeGeneratedBlock(), upsertGradleProperty(), withAndroidPlayCompliance(), assert (+4 more)

### Community 32 - "generate-legal-loading-documents.js"
Cohesion: 0.24
Nodes (13): cleanLoadingTag(), DOCUMENTS, extractDocumentBody(), fs, generateLoadingMdxBody(), getLineCount(), getRoleClass(), getWidthClass() (+5 more)

### Community 33 - "authServices.js"
Cohesion: 0.24
Nodes (7): createAppleSignInNonce(), createAuthFlowError(), reauthenticateForAccountDeletion(), reauthenticateWithApple(), reauthenticateWithGoogle(), reauthenticateWithPassword(), revokeAppleAuthorizationForDeletion()

### Community 34 - "dependencies"
Cohesion: 0.15
Nodes (13): expo, expo-blur, expo-constants, expo-image-manipulator, expo-notifications, firebase, dependencies, expo (+5 more)

### Community 35 - "t"
Cohesion: 0.26
Nodes (8): useCalendarLogic(), useScheduleActions(), useScheduleSync(), LanguageSettings(), AutoSaveManager(), styles, t(), translations

### Community 36 - "accountDeletionService.js"
Cohesion: 0.28
Nodes (11): AccountDataDeletionError, collectStorageItems(), createStepError(), deleteAllUserCloudData(), deleteAttachmentStorage(), deleteOwnedShares(), deleteQueryInBatches(), deleteStorageItems() (+3 more)

### Community 37 - "cookieConsentService.web.js"
Cohesion: 0.45
Nodes (12): clearConsentExpiryTimer(), createBrowserEvent(), dispatchConsentChange(), getBrowserWindow(), isConsentStatus(), readCookieConsent(), removeStoredConsent(), requestCookiePreferences() (+4 more)

### Community 38 - "withWidgetUpdateScheduler.js"
Cohesion: 0.26
Nodes (11): addUnique(), coreProviderSource(), fs, moduleSource(), packageSource(), path, PERMISSIONS, schedulerSource() (+3 more)

### Community 39 - "AuthScreen.jsx"
Cohesion: 0.20
Nodes (5): AUTH_LAYOUT_ANIMATION, AuthScreen(), configureAuthLayoutAnimation(), getIconConfig(), styles

### Community 40 - "firestoreSync.test.cjs"
Cohesion: 0.17
Nodes (9): assert, babel, firestorePath, fs, makeFakes(), Module, path, test (+1 more)

### Community 41 - "useEntityManager.js"
Cohesion: 0.40
Nodes (7): createDefaultGradient(), createDefaultLink(), createDefaultSubject(), createDefaultTeacher(), useEntityManager(), useUniqueId(), generateId()

### Community 42 - "LessonCard.jsx"
Cohesion: 0.20
Nodes (7): ActiveHighlight, BackgroundPattern, cachedPatternPositions, isLightColor(), LessonCardPure, styles, useLessonData()

### Community 43 - "FileLibraryScreen.jsx"
Cohesion: 0.33
Nodes (10): FileLibraryScreen(), getAttachmentFileRefId(), getAttachmentPreviewUri(), getFileIcon(), interpolate(), makeFileLibraryAttachmentError(), removeFileReferencesFromSchedule(), styles (+2 more)

### Community 44 - "crashlytics.native.js"
Cohesion: 0.35
Nodes (8): consoleErrorReports, createSanitizedError(), initGlobalErrorHandling(), logCrashlyticsError(), logCrashlyticsMessage(), sanitizeText(), shouldReportConsoleError(), summarizeValue()

### Community 45 - "reminderSettings.js"
Cohesion: 0.36
Nodes (10): clampReminderMinutes(), DEFAULT_SCHEDULE_REMINDER, getReminderSelectionId(), getScheduleReminderSelectionId(), isReminderObject(), normalizeReminder(), normalizeScheduleReminder(), normalizeSubjectReminder() (+2 more)

### Community 46 - "adMobCompliance.test.cjs"
Cohesion: 0.18
Nodes (8): adConfigPath, assert, babel, fs, Module, path, servicePath, test

### Community 47 - "localStorageDurability.test.cjs"
Cohesion: 0.20
Nodes (8): assert, babel, compileModule(), fs, loadStorageModule(), Module, path, test

### Community 48 - "nativeModuleGuards.test.cjs"
Cohesion: 0.22
Nodes (10): assert, babel, fs, loadNavigationMetrics(), loadNotificationService(), Module, navigationMetricsPath, notificationServicePath (+2 more)

### Community 49 - "widgetCore.test.cjs"
Cohesion: 0.18
Nodes (8): assert, babel, fs, Module, path, scheduleCore, scheduleCorePath, test

### Community 50 - "scheduleRecordMerge.js"
Cohesion: 0.44
Nodes (9): addScheduleRecordToMap(), ARRAY_FIELDS, chooseStartingWeek(), getArrayScore(), getCompletenessScore(), isValidDateValue(), isValidRepeatValue(), mergeScheduleRecords() (+1 more)

### Community 51 - "accountDeletionAuth.test.cjs"
Cohesion: 0.20
Nodes (7): assert, babel, fs, Module, path, servicePath, test

### Community 52 - "accountDeletionService.test.cjs"
Cohesion: 0.20
Nodes (7): assert, babel, fs, Module, path, servicePath, test

### Community 53 - "cookieConsent.test.cjs"
Cohesion: 0.22
Nodes (7): assert, babel, compileCommonJsModule(), fs, Module, path, test

### Community 54 - "app.config.js"
Cohesion: 0.22
Nodes (6): androidAdMobAppId, firebaseAuthLinkHost, firebaseProjectId, googleDemoAppIds, iosAdMobAppId, versionParts

### Community 55 - "Header.jsx"
Cohesion: 0.28
Nodes (6): AnimatedTouchable, Header(), isSameDay(), styles, SchedulePickerSheet(), styles

### Community 56 - "ColorScreen.jsx"
Cohesion: 0.28
Nodes (6): LessonEditorSubjectColorScreen(), styles, ColorPicker(), styles, GradientGrid(), styles

### Community 57 - "inferAttachmentMimeType"
Cohesion: 0.22
Nodes (15): createAndroidDownloadFile(), createDraftAttachment(), EXACT_MIME_TYPES, getAndroidDownloadFileName(), getAssetFile(), getAssetName(), getAssetSize(), inferAttachmentMimeType() (+7 more)

### Community 58 - "passwordPolicy.test.cjs"
Cohesion: 0.22
Nodes (7): assert, babel, fs, Module, modulePath, path, test

### Community 59 - "passwordResetService.test.cjs"
Cohesion: 0.25
Nodes (8): assert, babel, fs, loadPasswordResetService(), Module, path, servicePath, test

### Community 60 - "scheduleOwnership.test.cjs"
Cohesion: 0.22
Nodes (7): assert, babel, fs, Module, ownership, path, test

### Community 61 - "passwordPolicy.js"
Cohesion: 0.39
Nodes (5): PasswordStrengthBar(), styles, getPasswordPolicyStatus(), getPasswordStrength(), isPasswordAllowed()

### Community 62 - "MorphingLoader"
Cohesion: 0.29
Nodes (5): styles, getStyles(), PasswordResetScreen(), createFrameQueue(), MorphingLoader()

### Community 63 - "analytics.web.js"
Cohesion: 0.29
Nodes (4): deleteAnalyticsCookies(), DENIED_CONSENT, disableAnalytics(), GRANTED_ANALYTICS_CONSENT

### Community 64 - "Graphify Setup"
Cohesion: 0.29
Nodes (6): Build the Project Graph, Codex Integration, Graphify Setup, Install the CLI, Query the Graph, Team Notes

### Community 65 - "package.json"
Cohesion: 0.29
Nodes (6): main, name, overrides, websocket-driver, private, version

### Community 66 - "useNowTick.js"
Cohesion: 0.48
Nodes (6): createNowTickStore(), isTimerRelevantDate(), NowTickContext, NowTickProvider(), startOfDay(), useNowTick()

### Community 67 - "NotificationInboxPanel.jsx"
Cohesion: 0.43
Nodes (6): CARD_EXPAND_ANIMATION, configureCardLayoutAnimation(), interpolate(), NotificationInboxPanel(), styles, timestampToMs()

### Community 68 - "passwordActionEmailTemplates.js"
Cohesion: 0.60
Nodes (4): COPY, createAddPasswordEmailContent(), escapeHtml(), normalizePasswordEmailLocale()

### Community 69 - "passwordActionEmailSecurity.test.js"
Cohesion: 0.33
Nodes (5): handler, handlerEnd, handlerStart, source, testDirectory

### Community 70 - "BottomSheet.jsx"
Cohesion: 0.33
Nodes (5): BottomSheet, DEFAULT_SNAP_POINTS, SheetFlatList, SheetScrollView, styles

### Community 71 - "firebase.js"
Cohesion: 0.33
Nodes (4): app, db, firebaseConfig, storageBucketName

### Community 72 - "BreakCard.jsx"
Cohesion: 0.47
Nodes (5): AnimatedBreakCard, BreakCard(), checkBreakState(), getDiffMinutes(), styles

### Community 74 - "Schedule.jsx"
Cohesion: 0.40
Nodes (5): DayPage, DAYS_INDICES, getLocalISODate(), Schedule(), styles

### Community 77 - "devDependencies"
Cohesion: 0.40
Nodes (5): @babel/core, cross-env, devDependencies, @babel/core, cross-env

### Community 78 - "Account deletion deployment"
Cohesion: 0.40
Nodes (4): Account deletion deployment, Apple secret values, Required deployment order, Verification checklist

### Community 84 - "fix-build.js"
Cohesion: 0.50
Nodes (3): distPath, fs, path

### Community 90 - "DeleteAccountScreen.jsx"
Cohesion: 0.83
Nodes (3): DeleteAccountScreen(), getDeletionErrorKey(), getStyles()

### Community 92 - "TaskScheduleFilterSheet.jsx"
Cohesion: 0.67
Nodes (3): styles, TaskScheduleFilterSheet(), uniqueIds()

## Knowledge Gaps
- **437 isolated node(s):** `fs`, `path`, `distPath`, `GALLERY_SPRING`, `ZOOM_SPRING` (+432 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **76 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useScheduleData()` connect `useScheduleData` to `notificationService.js`, `t`, `storage.js`, `navigationMetrics.js`, `AccountSettings.jsx`, `ScheduleProvider.jsx`, `ColorScreen.jsx`, `SharedSchedulesManager.jsx`, `LanguageSettings.jsx`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `SettingsHeader()` connect `TaskEditor.jsx` to `LanguageSettings.jsx`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `distPath` to the rest of the system?**
  _437 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `notificationService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05570611261668172 - nodes in this community are weakly interconnected._
- **Should `widgetCore.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06949152542372881 - nodes in this community are weakly interconnected._
- **Should `attachmentService.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0726764500349406 - nodes in this community are weakly interconnected._
- **Should `TaskEditor.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06636500754147813 - nodes in this community are weakly interconnected._