const themes = {
  light: {
    backgroundColor: '#fff',
    backgroundColor2: '#e1e1e1',
    backgroundColor3: '#aaaaaaff',
    backgroundColor4: '#f1f1f1ff',

    backgroundColorTabNavigator: '#fff',

    textColor: '#000',
    textColor2: '#7a7a80',
    textColor3: '#7a7a80',

    textColorScheduleCard: '#000',
  },
  dark: {
    backgroundColor: '#252527',
    backgroundColor2: '#373737',
    backgroundColor3: '#000',
    backgroundColor4: '#222',

    backgroundColorTabNavigator: '#252527f0',

    textColor: '#fff',
    textColor2: '#7a7a80',
    textColor3: '#7a7a80',

    textColorScheduleCard: '#252527',
  },
  accentColors: {
  // Базові
  red: "#FD6A6A",
  blue: "#4A90E2",
  green: "#6FCF97",
  yellow: "#F2C94C",
  orange: "#F2994A",
  purple: "#9B51E0",
  pink: "#FF70A6",
  grey: "#7A7A80",

  // Пастельні
  pastelBlue: "#AECBFA",
  pastelGreen: "#B9FBC0",
  pastelPink: "#FFD6E0",
  pastelPurple: "#E0BBE4",
  pastelYellow: "#FFF5BA",

  // Неонові
  neonCyan: "#00FFF7",
  neonPink: "#FF4DFF",
  neonOrange: "#FF9500",

  // Глибокі
  deepBlue: "#00264D",
  deepRed: "#8B0000",
  deepPurple: "#2E0854",
  deepTeal: "#014D4E",
},

  /**
   * Отримати повну палітру кольорів
   * @param {"light"|"dark"} mode - тип теми
   * @param {string} accent - назва акцентного кольору
   */
  getColors(mode = "light", accent = "blue") {
    const baseTheme = this[mode] || this.light;
    const accentColor = this.accentColors[accent] || this.accentColors.blue;

    return {
      ...baseTheme,
      accentColor, // додаємо поле для зручного доступу
    };
  },
};

export default themes;
