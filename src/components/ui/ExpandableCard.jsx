import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { CaretUp, CaretDown } from 'phosphor-react-native';

export default function ExpandableCard({
  title,
  value,
  icon: Icon,
  themeColors,
  isExpanded,
  onToggle,
  children,
  hideChevronOnAndroid = false
}) {
  return (
    <View style={[
      styles.card, 
      { 
        backgroundColor: themeColors.backgroundColor2, 
        borderColor: isExpanded ? themeColors.accentColor : themeColors.borderColor 
      }
    ]}>
      <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.rowLeft}>
          {Icon && (
            <View style={[styles.iconContainer, { backgroundColor: themeColors.accentColor + '15' }]}>
              <Icon size={20} color={themeColors.accentColor} weight="fill" />
            </View>
          )}
          <Text style={[styles.rowLabel, { color: themeColors.textColor }]}>
            {title}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[
            styles.rowValue, 
            { 
              color: isExpanded ? themeColors.accentColor : themeColors.textColor2, 
              fontWeight: isExpanded ? 'bold' : 'normal' 
            }
          ]}>
            {value}
          </Text>
          {!(hideChevronOnAndroid && Platform.OS === 'android') && (
            isExpanded ? (
              <CaretUp size={18} color={themeColors.textColor2} weight="bold" />
            ) : (
              <CaretDown size={18} color={themeColors.textColor2} weight="bold" />
            )
          )}
        </View>
      </TouchableOpacity>
      
      {isExpanded && children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    borderRadius: 16, 
    borderWidth: StyleSheet.hairlineWidth, 
    marginBottom: 12, 
    overflow: 'hidden' 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 14 
  },
  rowLeft: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  rowRight: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  iconContainer: { 
    width: 36, 
    height: 36, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  rowLabel: { 
    fontSize: 16, 
    fontWeight: '500' 
  },
  rowValue: { 
    fontSize: 15, 
    marginRight: 8 
  },
});