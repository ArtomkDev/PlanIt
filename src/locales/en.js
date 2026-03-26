export default {
  languages: {
    uk: "Ukrainian",
    en: "English",
    pl: "Polish",
    de: "German",
  },

  common: {
    schedule: "Schedule",
    settings: "Settings",
    save: "Save",
    cancel: "Cancel",
    back: "Back",
    enabled: "Enabled",
    disabled: "Disabled",
    error: "Error",
    confirm: "Confirm",
    success: "Success",
    warning: "Warning",
    delete: "Delete",
    create: "Create",
  },

  settings: {
    // Назви головних секцій на екрані налаштувань
    sections: {
      schedule: "Schedule Structure",
      data: "Data",
      appearance: "Appearance",
      automation: "Automation",
      account: "Account",
      danger_zone: "Danger Zone",
    },

    // Головний екран налаштувань (пункти меню)
    menu: {
      weeks: { title: "Number of Weeks", desc: "Odd/even or week cycle" },
      start_date: { title: "Start Date", desc: "Week # starts from here" },
      breaks: { title: "Number of Breaks", desc: "Length and amount of breaks" },
      schedule: { title: "Schedule", desc: "Daily classes editor" },
      global_schedule: { title: "Global Schedule", desc: "Change global schedule" },
      
      subjects: { title: "Subjects", desc: "List of subjects / classrooms" },
      teachers: { title: "Teachers", desc: "Contacts and abbreviations" },
      
      themes: { title: "Themes", desc: "Light/dark, accent" },
      language: { title: "Language", desc: "Select interface language" },
      
      autosave: { title: "Auto-save", desc: "Background saving of changes" },
      every_sec: "every {val} sec",
      
      login: { title: "Log In or Create Account", desc: "Sync your data to the cloud" },
      devices: { title: "Devices", desc: "Authorized devices settings" },
      logout: { title: "Log Out", desc: "End current session" },
      
      reset_db: { title: "Reset Database", desc: "Complete data wipe" },
    },

    // Окремий екран: Налаштування мови
    language_screen: {
      title: "Language",
      subtitle: "Select interface language",
      desc: "This will change the language of buttons, menus, and system notifications",
      info_note: "Language settings are synced with your account and stored locally on this device",
    },

    // Окремий екран: Налаштування теми
    theme_screen: {
      mode_title: "Mode",
      modes: {
        light: "Light",
        dark: "Dark",
        oled: "OLED",
      },
      blur_title: "Blur Effect",
      blur_desc_oled: "In OLED mode, blur will be dark",
      blur_desc_normal: "Transparency of interface elements",
      accent_title: "Accent Color",
      preview: {
        title: "Preview",
        header: "Accent color header",
        blur_label: "Blur:",
        mode_label: "Mode:",
        button: "Button",
      }
    },

    device_screen: {
      unknown_device: "Unknown Device",
      web_browser: "Web Browser",
      unknown_os: "Unknown OS",
      unknown_date: "Unknown",
      loading: "Loading devices...",
      current: "Current",
      active_sessions: "Active Sessions",
      logout_all_others: "Log out on all other devices",
    },

    autosave_screen: {
      interval_label: "Auto-save interval (seconds):",
      info_text: "This setting affects the frequency of data saving to the cloud.",
    },
    reset_db_screen: {
      alert_title: "Reset schedules?",
      alert_msg: "Your theme and account settings will be preserved, but all created schedules will be deleted and replaced with the default.",
      alert_confirm: "Reset",
      success_msg: "Schedules updated.",
      box_title: "Clear schedules",
      box_text: "This action will delete all your current classes and schedules, but keep app settings.",
      button_text: "Reset schedules",
    },

    week_manager: {
      repeat_label: "Number of repeating weeks:",
    },
    start_week_manager: {
      select_date: "Select date",
    },

    breaks_manager: {
      title: "Breaks Settings",
      break_item: "Break",
      minutes: "min",
      add_btn: "Add break",
    },

    schedule_switcher: {
      last_schedule_error: "You cannot delete the last schedule.",
      delete_title: "Delete schedule?",
      delete_confirm_msg: "Are you sure you want to delete the schedule \"{name}\"? This action cannot be undone.",
      untitled: "Untitled",
      your_schedules: "Your schedules",
      add_new: "Add new",
    },

    schedule_editor: {
      new_schedule: "New Schedule",
      edit_schedule: "Edit",
      schedule_name: "Schedule Name",
      enter_name: "Enter name...",
    },

    // Всі модальні вікна (Alerts) для налаштувань
    alerts: {
      logout_title: "Log Out",
      logout_confirm: "Are you sure you want to log out?",
      logout_error: "Failed to log out",
    }
  }
};