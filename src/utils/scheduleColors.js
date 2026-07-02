import tinycolor from "tinycolor2";

import themes from "../config/themes";

export const resolveScheduleColor = (schedule, fallback = themes.accentColors.blue) => {
  const rawColor = themes.accentColors[schedule?.color] || schedule?.color;
  const parsed = tinycolor(rawColor);
  return parsed.isValid() ? parsed.toHexString() : fallback;
};

export const scheduleColorWithAlpha = (color, alpha = 0.14) =>
  tinycolor(color).setAlpha(alpha).toRgbString();
