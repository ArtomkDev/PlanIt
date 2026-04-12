import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

export default function AdBanner() {
  const [RealAdComponent, setRealAdComponent] = useState(null);

  useEffect(() => {
    if (!isExpoGo) {
      import('./AdBannerImpl')
        .then((module) => {
          setRealAdComponent(() => module.default);
        })
        .catch((err) => console.warn('Failed to load Ad module:', err));
    }
  }, []);

  if (isExpoGo || !RealAdComponent) {
    return (
      <View style={styles.placeholderContainer}>
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>
            {isExpoGo ? 'AdMob Placeholder (Expo Go)' : 'Loading Ad...'}
          </Text>
        </View>
      </View>
    );
  }

  return <RealAdComponent />;
}

const styles = StyleSheet.create({
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