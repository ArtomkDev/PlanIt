import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdBanner() {
  return (
    <View style={styles.placeholderContainer}>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>AdMob (WEB PLATFORM)</Text>
      </View>
    </View>
  );
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