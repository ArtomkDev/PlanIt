const WEB_AD_STATE = Object.freeze({
  canRequestAds: false,
  initialized: false,
  privacyOptionsRequired: false,
});

export const initAds = async () => WEB_AD_STATE;
export const showAdPrivacyOptions = async () => WEB_AD_STATE;
