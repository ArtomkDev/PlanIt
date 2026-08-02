import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { isRunningInExpoGo } from 'expo';

import { useAds } from '../../context/AdsContext';

const isExpoGo = isRunningInExpoGo();

export default function AdBanner() {
  const { canShowAds } = useAds();
  const [RealAdComponent, setRealAdComponent] = useState(null);

  useEffect(() => {
    let active = true;

    if (!isExpoGo && canShowAds) {
      import('./AdBannerImpl')
        .then((module) => {
          if (active) setRealAdComponent(() => module.default);
        })
        .catch((error) => {
          if (__DEV__) {
            console.warn('Failed to load the AdMob banner module:', error);
          }
        });
    } else {
      setRealAdComponent(null);
    }

    return () => {
      active = false;
    };
  }, [canShowAds]);

  return (
    <View
      pointerEvents={canShowAds ? 'box-none' : 'none'}
      style={styles.placement}
    >
      {RealAdComponent ? <RealAdComponent /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placement: {
    width: '100%',
    minHeight: 75,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.32)',
  },
});
