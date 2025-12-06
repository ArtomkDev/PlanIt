import { Platform } from 'react-native';

const themes = {
  light: {
    backgroundColor: '#F2F4F7', // Дуже світлий сіро-блакитний (сучасний "сірий")
    backgroundColor2: '#FFFFFF', // Картки - чисто білі
    backgroundColor3: '#E2E8F0', // Інпути / Бордери - світло-сірі
    backgroundColor4: '#F8FAFC', // Альтернативний фон
    backgroundColorTabNavigator: '#FFFFFF', // Навігація
    
    textColor: '#1A202C', // Майже чорний, але м'якший (Cool Gray 900)
    textColor2: '#64748B', // Вторинний текст (Slate 500)
    textColor3: '#94A3B8', // Третинний текст (Slate 400)
    textColorScheduleCard: '#1A202C',
    
    borderColor: '#E2E8F0', // Колір розділювачів
  },
  dark: {
    backgroundColor: '#121214', // Глибокий темний (майже чорний, але м'який)
    backgroundColor2: '#1E1E22', // Картки - трохи світліші
    backgroundColor3: '#2D2D33', // Інпути - ще світліші
    backgroundColor4: '#18181B', 
    backgroundColorTabNavigator: '#1E1E22E6', // Напівпрозорий
    
    textColor: '#FFFFFF', // Білий
    textColor2: '#A1A1AA', // Світло-сірий (Zinc 400)
    textColor3: '#52525B', // Темно-сірий (Zinc 600)
    textColorScheduleCard: '#FFFFFF',
    
    borderColor: '#2D2D33',
  },
  // 🔥 Новий режим для економії батареї
  oled: {
    backgroundColor: '#000000', // Абсолютний чорний
    backgroundColor2: '#121212', // Material Dark Surface (для контрасту карток)
    backgroundColor3: '#1C1C1E', // Інпути
    backgroundColor4: '#000000',
    backgroundColorTabNavigator: '#000000',
    
    textColor: '#FFFFFF',
    textColor2: '#B0B0B0', // Більш контрастний сірий для OLED
    textColor3: '#333333',
    textColorScheduleCard: '#E0E0E0',
    
    borderColor: '#333333', // Важливо для розділення чорного на чорному
  },
  
  accentColors: {
    // Базові (оновлені, більш "смачні")
    red: "#FF4D4D",        // Більш живий червоний
    blue: "#3B82F6",       // Modern Blue (Tailwind style)
    green: "#10B981",      // Emerald
    yellow: "#F59E0B",     // Amber (краще читається на білому, ніж чистий жовтий)
    orange: "#F97316",     // Bright Orange
    purple: "#8B5CF6",     // Violet
    pink: "#EC4899",       // Pink
    grey: "#71717A",       // Zinc Grey

    // Пастельні (м'якіші для фонів)
    pastelBlue: "#BFDBFE",
    pastelGreen: "#A7F3D0",
    pastelPink: "#FBCFE8",
    pastelPurple: "#DDD6FE",
    pastelYellow: "#FDE68A",

    // Неонові (Cyberpunk style)
    neonCyan: "#06B6D4",
    neonPink: "#F472B6",
    neonLime: "#84CC16",

    // Глибокі (Professional style)
    deepBlue: "#1E3A8A",
    deepRed: "#991B1B",
    deepPurple: "#5B21B6",
    deepTeal: "#115E59",
  },

  getColors(mode = "light", accent = "blue") {
    // Фолбек, якщо mode некоректний
    const baseTheme = this[mode] || this.light;
    
    // Фолбек для акцентного кольору
    let accentColor = this.accentColors[accent];
    
    // Якщо акцент не знайдено в списку (це кастомний hex), використовуємо його як є
    if (!accentColor) {
      accentColor = (typeof accent === 'string' && accent.startsWith('#')) 
        ? accent 
        : this.accentColors.blue;
    }

    const textOnAccent = "#FFFFFF"; 

    return {
      ...baseTheme,
      accentColor,
      textOnAccent,
      // Додаткові похідні кольори для UI
      accentColorLight: accentColor + '20', // 20% прозорості для фонів кнопок
    };
  },
};

export default themes;