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
    edit: "Edit",
    done: "Done",
    save_changes: "Save changes",
    months: {
      jan: "January", feb: "February", mar: "March", apr: "April",
      may: "May", jun: "June", jul: "July", aug: "August",
      sep: "September", oct: "October", nov: "November", dec: "December"
    },
  },

  auth: {
    signin: {
      title: "Welcome back!",
      subtitle: "Sign in to sync your schedule.",
      forgot_password: "Forgot password?",
      submit: "Sign In",
      no_account: "Don't have an account? ",
      signup_link: "Sign Up",
    },
    signup: {
      title: "Create account",
      subtitle: "Sign up to keep your schedule in the cloud.",
      submit: "Create account",
      already_have_account: "Already have an account? ",
      login_link: "Sign In",
    },
    fields: {
      email: "Email address",
      password: "Password",
      name: "Your name",
    },
    errors: {
      fill_fields: "Please fill in all fields",
      signin_failed: "Sign in failed",
      signup_failed: "Registration failed",
      invalid_email: "Invalid email format",
      wrong_credentials: "Wrong email or password",
      too_many_requests: "Too many requests. Try again later.",
      email_already_in_use: "This email is already in use",
      weak_password: "Password is too weak (min 6 characters)",
    },
    welcome: {
      subtitle: "Your perfect class schedule is always at hand.",
      guest_btn: "Continue as guest",
    },
  },

  main_layout: {
    no_schedule_data: "No schedule data",
  },

  schedule: {
    loading: "Loading...",
    day_schedule: {
      no_classes: "No classes",
      add_hint: "Long press to add",
    },
    header: {
      today: "Today",
    },
    lesson_viewer: {
      untitled: "Untitled",
      time: "Time",
      room: "Room",
      teachers: "TEACHERS",
      materials: "MATERIALS",
      default_link: "Link",
      link_error: "Could not open link: ",
    },
    lesson_editor: {
      edit: "Edit",
      new_lesson: "New Lesson",
      card_color: "Card Color",
      gradient_settings: "Gradient Settings",
      teachers: "Teachers",
      links: "Links",
      subjects: "Subjects",
      lesson_type: "Lesson Type",
      choose_icon: "Choose Icon",
      selection: "Selection",
      building: "Building",
      room: "Room",
      change_name: "Change Name",
      input: "Input",
      edit_teacher: "Edit Teacher",
      edit_link: "Edit Link",
      delete_slot: "Delete slot",
      placeholder_building: "E.g.: Main",
      placeholder_room: "E.g.: 204",
      placeholder_subject: "Subject Name",
      not_selected: "Not selected",
      not_specified: "Not specified",
      editing: "Editing...",
      new_lesson_ellipsis: "New lesson...",
      subject_not_selected: "Subject not selected",
      color_tab: "Color",
      gradient_tab: "Gradient",
      gradient_angle: "Gradient Angle",
      save_gradient: "Save Gradient",
      new_link_default: "New link",
      link_name_label: "Link title",
      link_name_placeholder: "e.g. Zoom Lecture",
      link_url_label: "URL Address",
      teacher_name_label: "Teacher's Name",
      teacher_name_placeholder: "Enter full name",
      teacher_name_default: "No name",
      teacher_phone_label: "Contact / Phone",
      scope_local: "This lesson",
      scope_global: "All lessons",
    },
    lesson_types: {
      lecture: "Lecture",
      practice: "Practice",
      lab: "Laboratory",
      seminar: "Seminar",
    },
    picker_screen: {
      already_added: "Already added",
      add_new: "Add new",
      delete_slot: "Delete slot",
      reset_to_default: "Reset to default",
    },
    main_screen: {
      not_defined: "Not defined",
      none: "None",
      subject: "Subject",
      subject_name: "Subject Name",
      lesson_type_group: "Lesson Type",
      lesson_type_label: "Lesson Type",
      location: "Location",
      building: "Building",
      room: "Room",
      people: "People",
      no_teachers: "No teachers. Tap + to add",
      teacher: "Teacher",
      materials: "Materials",
      no_links: "No links. Tap + to add",
      link: "Link",
      appearance: "Appearance",
      card_color: "Card Color",
      subject_icon: "Subject Icon",
    }
  },

  settings: {
    sections: {
      schedule: "Schedule Structure",
      data: "Data",
      appearance: "Appearance",
      automation: "Automation",
      account: "Account",
      danger_zone: "Danger Zone",
    },

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

    language_screen: {
      title: "Language",
      subtitle: "Select interface language",
      desc: "This will change the language of buttons, menus, and system notifications",
      info_note: "Language settings are synced with your account and stored locally on this device",
    },

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

    alerts: {
      logout_title: "Log Out",
      logout_confirm: "Are you sure you want to log out?",
      logout_error: "Failed to log out",
    }
  }
};