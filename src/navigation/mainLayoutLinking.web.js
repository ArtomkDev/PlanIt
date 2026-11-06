const omitFromUrl = () => undefined;

export default {
  path: '',
  screens: {
    Onboarding: 'welcome',
    Tabs: {
      path: '',
      screens: {
        ScheduleTab: {
          path: '',
          stringify: { lessonViewIntent: omitFromUrl },
        },
        TasksTab: {
          path: 'tasks',
          stringify: { createTaskIntent: omitFromUrl },
        },
        SettingsTab: {
          path: 'settings',
          initialRouteName: 'SettingsOverview',
          screens: {
            SettingsOverview: '',
            ScheduleSwitcher: 'schedules',
            ScheduleEditorScreen: 'schedule/:scheduleId?',
            Theme: 'theme',
            Navigation: 'navigation',
            Language: 'language',
            ResetDB: 'reset',
            AboutApp: 'about',
            LegalDocument: 'legal/:documentType',
            DeviceManagement: 'devices',
            NotificationsScreen: 'notifications',
            FileLibrary: 'files',
            AccountSettings: 'account',
            DeleteAccount: 'account/delete',
            ChangeName: 'account/name',
            ChangeEmail: 'account/email',
            ChangePassword: 'account/password',
            SharedSchedulesManager: 'shared',
            SharedScheduleDetails: 'shared/:code',
          },
        },
      },
    },
  },
};
