export default {
  languages: {
    uk: "Українська",
    en: "English",
    pl: "Polski",
    de: "Deutsch",
  },

  common: {
    schedule: "Розклад",
    settings: "Налаштування",
    save: "Зберегти",
    cancel: "Скасувати",
    back: "Назад",
    enabled: "Увімкнено",
    disabled: "Вимкнено",
    error: "Помилка",
    confirm: "Підтвердити",
    success: "Успішно",
    warning: "Увага",
    delete: "Видалити",
    create: "Створити",
    edit: "Редагувати",
    done: "Готово",
    save_changes: "Зберегти зміни",
    months: {
      jan: "Січень", feb: "Лютий", mar: "Березень", apr: "Квітень",
      may: "Травень", jun: "Червень", jul: "Липень", aug: "Серпень",
      sep: "Вересень", oct: "Жовтень", nov: "Листопад", dec: "Грудень"
    },
  },

  auth: {
    common: {
      continue_with: "Продовжити через",
    },
    settings: {
      link_with: "Прив'язати до",
    },
    signin: {
      title: "З поверненням!",
      subtitle: "Увійдіть, щоб синхронізувати розклад.",
      forgot_password: "Забули пароль?",
      submit: "Увійти",
      no_account: "Ще не маєте акаунту? ",
      signup_link: "Зареєструватись",
    },
    signup: {
      title: "Створити акаунт",
      subtitle: "Зареєструйтесь, щоб зберігати розклад у хмарі.",
      submit: "Створити акаунт",
      already_have_account: "Вже є акаунт? ",
      login_link: "Увійти",
      accept_terms_prefix: "Я приймаю ",
      accept_terms_link: "Умови використання",
    },
    fields: {
      email: "Email пошта",
      password: "Пароль",
      name: "Ваше ім'я",
    },
    errors: {
      fill_fields: "Будь ласка, заповніть всі поля",
      signin_failed: "Помилка входу",
      signup_failed: "Помилка реєстрації",
      invalid_email: "Некоректний формат email",
      wrong_credentials: "Невірний email або пароль",
      too_many_requests: "Забагато спроб. Спробуйте пізніше.",
      email_already_in_use: "Цей email вже використовується",
      weak_password: "Пароль занадто слабкий (мінімум 6 символів)",
      accept_terms: "Будь ласка, прийміть Умови використання та Політику.",
    },
    welcome: {
      subtitle: "Ваш ідеальний розклад занять завжди під рукою.",
      guest_btn: "Продовжити як гість",
    },
  },

  main_layout: {
    no_schedule_data: "Немає даних розкладу",
  },

  schedule: {
    loading: "Завантаження...",
    day_schedule: {
      no_classes: "Пар немає",
      add_hint: "Затисніть екран, щоб додати",
    },
    header: {
      today: "Сьогодні",
    },
    lesson_viewer: {
      untitled: "Без назви",
      time: "Час",
      room: "Аудиторія",
      teachers: "ВИКЛАДАЧІ",
      materials: "МАТЕРІАЛИ",
      default_link: "Посилання",
      link_error: "Не вдалося відкрити посилання: ",
    },
    lesson_editor: {
      edit: "Редагування",
      new_lesson: "Нове заняття",
      card_color: "Колір картки",
      gradient_settings: "Налаштування градієнта",
      teachers: "Викладачі",
      links: "Посилання",
      subjects: "Предмети",
      lesson_type: "Тип заняття",
      choose_icon: "Оберіть іконку",
      selection: "Вибір",
      building: "Корпус",
      room: "Аудиторія",
      change_name: "Змінити назву",
      input: "Введення",
      edit_teacher: "Редагування викладача",
      edit_link: "Редагування посилання",
      delete_slot: "Видалити слот",
      placeholder_building: "Наприклад: Головний",
      placeholder_room: "Наприклад: 204",
      placeholder_subject: "Назва предмету",
      not_selected: "Не обрано",
      not_specified: "Не вказано",
      editing: "Редагування...",
      new_lesson_ellipsis: "Нове заняття...",
      subject_not_selected: "Предмет не обрано",
      color_tab: "Колір",
      gradient_tab: "Градієнт",
      gradient_angle: "Кут нахилу",
      save_gradient: "Зберегти градієнт",
      new_link_default: "Нове посилання",
      link_name_label: "Назва посилання",
      link_name_placeholder: "Напр. Zoom лекція",
      link_url_label: "URL адреса",
      teacher_name_label: "Ім'я викладача",
      teacher_name_placeholder: "Введіть ПІБ",
      teacher_name_default: "Без імені",
      teacher_phone_label: "Контакт / Телефон",
      scope_local: "Ця пара",
      scope_global: "Всі пари",
    },
    lesson_types: {
      lecture: "Лекція",
      practice: "Практика",
      lab: "Лабораторна",
      seminar: "Семінар",
    },
    picker_screen: {
      already_added: "Вже додано до пари",
      add_new: "Додати новий",
      delete_slot: "Видалити слот",
      reset_to_default: "Скинути до стандартних",
    },
    main_screen: {
      not_defined: "Не визначено",
      none: "Немає",
      subject: "Предмет",
      subject_name: "Назва предмету",
      lesson_type_group: "Тип заняття",
      lesson_type_label: "Тип заняття",
      location: "Місце проведення",
      building: "Корпус",
      room: "Аудиторія",
      people: "Люди",
      no_teachers: "Немає викладачів. Натисніть + щоб додати",
      teacher: "Викладач",
      materials: "Матеріали",
      no_links: "Немає посилань. Натисніть + щоб додати",
      link: "Посилання",
      appearance: "Оформлення",
      card_color: "Колір картки",
      subject_icon: "Іконка предмету",
    }
  },

  settings: {
    sections: {
      schedule: "Структура розкладу",
      data: "Дані",
      appearance: "Оформлення",
      automation: "Автоматизація",
      account: "Акаунт",
      danger_zone: "Небезпечна зона",
    },

    menu: {
      weeks: { title: "Кількість тижнів", desc: "Непарні/парні або цикл тижнів" },
      start_date: { title: "Початкова дата", desc: "Звідси рахується № тижня" },
      breaks: { title: "Кількість перерв", desc: "Довжина та кількість перерв" },
      schedule: { title: "Розклад", desc: "Редактор занять по днях" },
      global_schedule: { title: "Глобальний розклад", desc: "Змінити глобальний розклад" },
      
      subjects: { title: "Пари", desc: "Список предметів / аудиторій" },
      teachers: { title: "Викладачі", desc: "Контакти та скорочення" },
      
      themes: { title: "Теми", desc: "Світла/темна, акцент" },
      language: { title: "Мова", desc: "Вибір мови додатку" },
      
      autosave: { title: "Авто збереження", desc: "Фонове збереження змін" },
      every_sec: "кожні {val} сек",
      
      login: { title: "Увійти або Створити акаунт", desc: "Синхронізуйте дані в хмарі" },
      devices: { title: "Пристрої", desc: "Налаштування авторизованих пристроїв" },
      logout: { title: "Вийти з акаунту", desc: "Завершити сесію" },
      
      reset_db: { title: "Скинути БД", desc: "Повне очищення даних" },
    },

    language_screen: {
      title: "Мова",
      subtitle: "Виберіть мову інтерфейсу",
      desc: "Це змінить мову кнопок, меню та системних сповіщень",
      info_note: "Налаштування мови синхронізується з вашим акаунтом та зберігається локально на цьому пристрої",
    },

    theme_screen: {
      mode_title: "Режим",
      modes: {
        light: "Світла",
        dark: "Темна",
        oled: "OLED",
      },
      blur_title: "Ефект розмиття (Blur)",
      blur_desc_oled: "У режимі OLED блюр буде темним",
      blur_desc_normal: "Прозорість елементів інтерфейсу",
      accent_title: "Акцентний колір",
      preview: {
        title: "Результат",
        header: "Заголовок акцентним кольором",
        blur_label: "Блюр:",
        mode_label: "Режим:",
        button: "Кнопка",
      }
    },

    device_screen: {
      unknown_device: "Невідомий пристрій",
      web_browser: "Веб-браузер",
      unknown_os: "Невідома ОС",
      unknown_date: "Невідомо",
      loading: "Завантаження пристроїв...",
      current: "Поточний",
      active_sessions: "Активні сеанси",
      logout_all_others: "Вийти на всіх інших пристроях",
    },

    autosave_screen: {
      interval_label: "Інтервал автозбереження (секунди):",
      info_text: "Це налаштування впливає на частоту збереження даних у хмару.",
    },

    reset_db_screen: {
      alert_title: "Скинути розклади?",
      alert_msg: "Ваші налаштування теми та акаунту збережуться, але всі створені розклади будуть видалені і замінені на стандартний.",
      alert_confirm: "Скинути",
      success_msg: "Розклади оновлено.",
      box_title: "Очищення розкладів",
      box_text: "Ця дія видалить усі ваші поточні пари та розклади, але збереже налаштування додатку.",
      button_text: "Скинути розклади",
    },

    week_manager: {
      repeat_label: "Кількість тижнів повторення:",
    },
    start_week_manager: {
      select_date: "Вибрати дату",
    },

    breaks_manager: {
      title: "Налаштування перерв",
      break_item: "Перерва",
      minutes: "хв",
      add_btn: "Додати перерву",
    },

    schedule_switcher: {
      last_schedule_error: "Ви не можете видалити останній розклад.",
      delete_title: "Видалити розклад?",
      delete_confirm_msg: "Ви дійсно хочете видалити розклад \"{name}\"? Цю дію неможливо скасувати.",
      untitled: "Без назви",
      your_schedules: "Ваші розклади",
      add_new: "Додати новий",
    },

    schedule_editor: {
      new_schedule: "Новий розклад",
      edit_schedule: "Редагування",
      schedule_name: "Назва розкладу",
      enter_name: "Введіть назву...",
    },

    alerts: {
      logout_title: "Вихід",
      logout_confirm: "Ви впевнені, що хочете вийти з акаунту?",
      logout_error: "Не вдалося вийти з акаунту",
    }
  }
};