import tinycolor from "tinycolor2";

import themes from "../config/themes";
import { getGradientColor, resolveValidColor } from "./gradientColors";

export const getLessonColors = (lesson, schedule, fallback = themes.accentColors.grey) => {
  const subject = schedule?.subjects?.find((item) => item.id === lesson?.subjectId);
  const activeGrad = subject?.typeColor === "gradient"
    ? schedule?.gradients?.find((item) => item.id === subject.colorGradient) || null
    : null;
  const color = resolveValidColor(themes.accentColors[subject?.color] || subject?.color, fallback);
  return { activeGrad, subjectColor: getGradientColor(activeGrad, color) };
};

export const resolveScheduleColor = (schedule, fallback = themes.accentColors.blue) => {
  const rawColor = themes.accentColors[schedule?.color] || schedule?.color;
  const parsed = tinycolor(rawColor);
  return parsed.isValid() ? parsed.toHexString() : fallback;
};

export const scheduleColorWithAlpha = (color, alpha = 0.14) =>
  tinycolor(color).setAlpha(alpha).toRgbString();
