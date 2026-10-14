import tinycolor from 'tinycolor2';

const themes = {
  light: {
    backgroundColor: '#F2F4F7',
    backgroundColor2: '#FFFFFF',
    backgroundColor3: '#E2E8F0',
    backgroundColor4: '#F8FAFC',
    backgroundColorTabNavigator: '#FFFFFF',
    
    textColor: '#1A202C',
    textColor2: '#58677D',
    textColor3: '#646B77',
    textColorScheduleCard: '#1A202C',
    
    borderColor: '#E2E8F0',
  },
  
  dark: {
    backgroundColor: '#121214',
    backgroundColor2: '#1E1E22',
    backgroundColor3: '#2D2D33',
    backgroundColor4: '#18181B',
    backgroundColorTabNavigator: '#1E1E22',
    
    textColor: '#FFFFFF',
    textColor2: '#A1A1AA',
    textColor3: '#8A8A94',
    textColorScheduleCard: '#FFFFFF',
    
    borderColor: '#2D2D33',
  },
  
  oled: {
    backgroundColor: '#000000',
    backgroundColor2: '#121212',
    backgroundColor3: '#1C1C1E',
    backgroundColor4: '#000000',
    backgroundColorTabNavigator: '#000000',
    
    textColor: '#FFFFFF',
    textColor2: '#B0B0B0',
    textColor3: '#8E8E93',
    textColorScheduleCard: '#E0E0E0',
    
    borderColor: '#333333',
  },
  
  accentColors: {
    red: '#EF4444',
    orange: '#F97316',
    amber: '#F59E0B',
    yellow: '#EAB308',

    lime: '#84CC16',
    green: '#10B981',
    emerald: '#059669',
    teal: '#14B8A6',

    cyan: '#06B6D4',
    sky: '#0EA5E9',
    blue: '#3B82F6',
    indigo: '#6366F1',

    violet: '#8B5CF6',
    purple: '#A855F7',
    fuchsia: '#D946EF',
    pink: '#EC4899',

    pastelPink: '#FBCFE8',
    pastelYellow: '#FDE68A',
    pastelGreen: '#A7F3D0',
    pastelBlue: '#BFDBFE',

    deepRed: '#991B1B',
    deepBlue: '#1E3A8A',
    deepPurple: '#5B21B6',
    grey: '#71717A',
  },

  getColors(mode = "light", accent = "blue") {
    const baseTheme = this[mode] || this.light;
    
    let accentColor = this.accentColors[accent];
    
    if (!accentColor) {
      accentColor = (typeof accent === 'string' && accent.startsWith('#')) 
        ? accent 
        : this.accentColors.blue;
    }

    const textOnAccent = tinycolor.mostReadable(accentColor, ['#FFFFFF', '#111827'], { includeFallbackColors: true }).toHexString();
    let accentTextColor = accentColor;
    for (let amount = 0; amount <= 100; amount += 10) {
      const candidate = tinycolor.mix(accentColor, baseTheme.textColor, amount).toHexString();
      if ([baseTheme.backgroundColor, baseTheme.backgroundColor2].every(background => tinycolor.readability(candidate, background) >= 4.5)) {
        accentTextColor = candidate;
        break;
      }
    }

    return {
      ...baseTheme,
      accentColor,
      accentTextColor,
      textOnAccent,
      accentColorLight: accentColor + '20',
    };
  },
};

export default themes;
