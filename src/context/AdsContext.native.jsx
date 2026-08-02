import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  initAds,
  showAdPrivacyOptions,
} from '../utils/adInit/adInit';

const DEFAULT_ADS_STATE = Object.freeze({
  canShowAds: false,
  consentError: null,
  isLoading: true,
  isPrivacyOptionsLoading: false,
  openPrivacyOptions: async () => {},
  privacyOptionsRequired: false,
});

const AdsContext = createContext(DEFAULT_ADS_STATE);

export function AdsProvider({ children }) {
  const mountedRef = useRef(true);
  const [state, setState] = useState({
    canShowAds: false,
    consentError: null,
    isLoading: true,
    isPrivacyOptionsLoading: false,
    privacyOptionsRequired: false,
  });

  const applyAdState = useCallback((nextState) => {
    if (!mountedRef.current) return;

    setState((previous) => ({
      ...previous,
      canShowAds:
        nextState?.canRequestAds === true && nextState?.initialized === true,
      consentError: null,
      isLoading: false,
      isPrivacyOptionsLoading: false,
      privacyOptionsRequired:
        nextState?.privacyOptionsRequired === true,
    }));
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    initAds()
      .then(applyAdState)
      .catch((error) => {
        if (!mountedRef.current) return;
        setState((previous) => ({
          ...previous,
          canShowAds: false,
          consentError: error,
          isLoading: false,
        }));
      });

    return () => {
      mountedRef.current = false;
    };
  }, [applyAdState]);

  const openPrivacyOptions = useCallback(async () => {
    if (!state.privacyOptionsRequired || state.isPrivacyOptionsLoading) {
      return;
    }

    setState((previous) => ({
      ...previous,
      isPrivacyOptionsLoading: true,
    }));

    try {
      const nextState = await showAdPrivacyOptions();
      applyAdState(nextState);
    } catch (error) {
      if (mountedRef.current) {
        setState((previous) => ({
          ...previous,
          consentError: error,
          isPrivacyOptionsLoading: false,
        }));
      }
      throw error;
    }
  }, [applyAdState, state.isPrivacyOptionsLoading, state.privacyOptionsRequired]);

  const value = useMemo(
    () => ({
      ...state,
      openPrivacyOptions,
    }),
    [openPrivacyOptions, state],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export const useAds = () => useContext(AdsContext);
