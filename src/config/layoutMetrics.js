export const APP_HEADER_SAFE_TOP_MIN = 8;
export const APP_HEADER_BODY_HEIGHT = 92;
export const APP_HEADER_CONTENT_GAP = 10;

export const getAppHeaderTopInset = (topInset = 0) => (
  Math.max(topInset || 0, APP_HEADER_SAFE_TOP_MIN)
);

export const getAppHeaderHeight = (topInset = 0) => (
  getAppHeaderTopInset(topInset) + APP_HEADER_BODY_HEIGHT
);
