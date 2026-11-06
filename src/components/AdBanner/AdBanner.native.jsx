import React, { useEffect, useState } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

import { useAds } from '../../context/AdsContext';
import { useIsAppDialogVisible } from '../../context/AppDialogContext';

const isExpoGo = isRunningInExpoGo();
// The development-only settings switch; release bundles drop the require together with the dead branch.
const useDevAdsHidden = __DEV__ ? require('../../config/development/screenshotMode').useDevAdsHidden : () => false;

export default function AdBanner({ visible = true, reserveSpace = false }) {
  const { canShowAds, isPrivacyOptionsLoading } = useAds();
  const isDialogVisible = useIsAppDialogVisible();
  const devAdsHidden = useDevAdsHidden();
  const [RealAdComponent, setRealAdComponent] = useState(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [windowFocused, setWindowFocused] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  const bannerVisible = visible && appActive && windowFocused && !keyboardVisible && !isPrivacyOptionsLoading && !isDialogVisible;

  useEffect(() => {
    const subscriptions = [
      AppState.addEventListener('change', (state) => setAppActive(state === 'active')),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true)),
      Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false)),
    ];
    if (Platform.OS === 'android') {
      subscriptions.push(
        AppState.addEventListener('blur', () => setWindowFocused(false)),
        AppState.addEventListener('focus', () => setWindowFocused(true)),
      );
    }
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  useEffect(() => {
    if (!canShowAds) {
      setRealAdComponent(null);
    } else if (!isExpoGo && bannerVisible && !RealAdComponent) {
      try {
        const { default: AdBannerImpl } = require('./AdBannerImpl');
        setRealAdComponent(() => AdBannerImpl);
      } catch (error) {
        if (__DEV__) {
          console.warn('Failed to load the AdMob banner module:', error);
        }
      }
    }
  }, [canShowAds, bannerVisible, RealAdComponent]);

  if (isExpoGo || !canShowAds || devAdsHidden || !RealAdComponent) return null;

  return <RealAdComponent visible={bannerVisible} reserveSpace={reserveSpace} />;
}
