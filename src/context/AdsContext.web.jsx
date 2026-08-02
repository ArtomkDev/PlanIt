import React, { createContext, useContext } from 'react';

const WEB_ADS_STATE = Object.freeze({
  canShowAds: false,
  consentError: null,
  isLoading: false,
  isPrivacyOptionsLoading: false,
  openPrivacyOptions: async () => {},
  privacyOptionsRequired: false,
});

const AdsContext = createContext(WEB_ADS_STATE);

export function AdsProvider({ children }) {
  return (
    <AdsContext.Provider value={WEB_ADS_STATE}>
      {children}
    </AdsContext.Provider>
  );
}

export const useAds = () => useContext(AdsContext);
