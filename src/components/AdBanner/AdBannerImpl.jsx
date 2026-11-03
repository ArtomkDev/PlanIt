import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AD_UNITS } from '../../config/ads';

const MIN_BANNER_WIDTH = 320;

export default function AdBannerImpl({ visible = true, reserveSpace = false }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hasFailed, setHasFailed] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(60);
  const bannerWidth = Math.floor(width - insets.left - insets.right);
  const handleSizeChange = ({ height }) => setBannerHeight(Math.max(60, Math.ceil(height)));

  if (!AD_UNITS.BANNER || hasFailed || bannerWidth < MIN_BANNER_WIDTH) {
    return null;
  }

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.placement,
        !visible && !reserveSpace && styles.hidden,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View style={[styles.container, { width: bannerWidth, minHeight: bannerHeight }]}>
        {/* Hide the native view, retaining its instance and measured space while an overlay is open. */}
        <View collapsable={false} style={!visible && styles.hidden}>
          <BannerAd
            unitId={AD_UNITS.BANNER}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            width={bannerWidth}
            onAdLoaded={handleSizeChange}
            onSizeChange={handleSizeChange}
            requestOptions={{
              // PlanIt does not use schedule/account data for ad personalization.
              requestNonPersonalizedAdsOnly: true,
            }}
            onAdFailedToLoad={(error) => {
              // Remove the native ad with its slot so refresh cannot reuse released space.
              setHasFailed(true);
              if (__DEV__) {
                console.warn('AdMob banner failed to load:', error);
              }
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  placement: {
    width: '100%',
    flexShrink: 0,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.32)',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    flexShrink: 0,
  },
});
