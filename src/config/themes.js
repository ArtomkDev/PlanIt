const themes = {
  light: {
    backgroundColor: '#fff',
    backgroundColor2: '#e1e1e1',
    backgroundColor3: '#0a0a0a',

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

    backgroundColorTabNavigator: '#252527f0',

    textColor: '#fff',
    textColor2: '#7a7a80',
    textColor3: '#7a7a80',

    textColorScheduleCard: '#252527',
  },
  accentColors: {
    red: '#fdabab',
    blue: '#00457E',
    green: '#C6F8BD',
    yellow: '#F7FAB2',
    orange: '#FFD7A6',
    purple: '#9BBFF8',
    pink: '#FAC1FA',
    grey: '#7a7a80',
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
