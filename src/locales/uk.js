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
  },

  settings: {
    // Назви головних секцій на екрані налаштувань
    sections: {
      schedule: "Структура розкладу",
      data: "Дані",
      appearance: "Оформлення",
      automation: "Автоматизація",
      account: "Акаунт",
      danger_zone: "Небезпечна зона",
    },

    // Головний екран налаштувань (пункти меню)
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

    // Окремий екран: Налаштування мови
    language_screen: {
      title: "Мова",
      subtitle: "Виберіть мову інтерфейсу",
      desc: "Це змінить мову кнопок, меню та системних сповіщень",
      info_note: "Налаштування мови синхронізується з вашим акаунтом та зберігається локально на цьому пристрої",
    },

    // Окремий екран: Налаштування теми
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

    // Всі модальні вікна (Alerts) для налаштувань
    alerts: {
      logout_title: "Вихід",
      logout_confirm: "Ви впевнені, що хочете вийти з акаунту?",
      logout_error: "Не вдалося вийти з акаунту",
    }
  }
};