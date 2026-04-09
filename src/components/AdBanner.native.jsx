import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { AD_UNITS } from '../config/ads';

const isExpoGo = Constants.appOwnership === 'expo';

let BannerAd = null;
let BannerAdSize = null;

if (!isExpoGo) {
  try {
    const Ads = require('react-native-google-mobile-ads');
    BannerAd = Ads.BannerAd;
    BannerAdSize = Ads.BannerAdSize;
  } catch (e) {
    console.warn("Ads module not found", e);
  }
}

export default function AdBanner() {
  if (isExpoGo || !BannerAd) {
    return (
      <View style={styles.placeholderContainer}>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>AdMob (EXPO GO PLATFORM)</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNITS.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ 
          requestNonPersonalizedAdsOnly: true 
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
    backgroundColor: 'transparent'
  },
  placeholderContainer: { 
    width: '100%', 
    alignItems: 'center', 
    paddingVertical: 10 
  },
  placeholderBox: {
    width: '90%', 
    height: 60, 
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(150,150,150,0.2)',
    borderStyle: 'dashed', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  placeholderText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#999' 
  }
});