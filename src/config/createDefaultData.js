export default function createDefaultData() {
  const now = Date.now();

  const global = {
    currentScheduleId: null,
    theme: ['dark', 'cyan'],
    navigationStyle: 'classic',
    navigationLabels: true,
    navigationAnimations: true,
    hapticsEnabled: true,
    fileLibrary: [],
    lastModified: now, 
    lastSynced: 0, 
  };

  return { 
    global,
    // The first schedule is created only by OnboardingWizard after the user
    // finishes the setup. Keeping defaults empty prevents a background draft
    // from racing the onboarding screen and briefly replacing it with Tabs.
    schedules: [],
    deletedSchedules: [],
  };
}
