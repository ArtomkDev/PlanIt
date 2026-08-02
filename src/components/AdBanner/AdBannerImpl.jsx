import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { AD_UNITS } from '../../config/ads';

export default function AdBannerImpl() {
  if (!AD_UNITS.BANNER) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNITS.BANNER}
        size={BannerAdSize.BANNER}
        requestOptions={{
          // PlanIt does not use schedule/account data for ad personalization.
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          if (__DEV__) {
            console.warn('AdMob banner failed to load:', error);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
  },
});
