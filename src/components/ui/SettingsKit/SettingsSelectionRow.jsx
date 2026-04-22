import React from "react";
import { TouchableOpacity, Text, StyleSheet, View, Platform } from "react-native";
import { PencilSimple } from "phosphor-react-native";

const isAndroid = Platform.OS === "android";

export default function SettingsSelectionRow({
  label,
  hint, 
  isSelected = false,
  isAlreadySelected = false,
  onPress,
  onLongPress,
  onEdit, 
  rightContent, 
  themeColors
}) {
  
  const androidBg = isSelected ? (themeColors.accentColor + '15') : themeColors.backgroundColor2;
  const iosBg = themeColors.backgroundColor2;

  return (
    <TouchableOpacity
      style={[
        styles.container, 
        { 
          backgroundColor: isAndroid ? androidBg : iosBg, 
          borderColor: isSelected ? themeColors.accentColor : (isAndroid ? themeColors.borderColor + '30' : themeColors.borderColor + '50'), 
          opacity: isAlreadySelected ? 0.5 : 1,
          marginHorizontal: 0, 
          marginBottom: 0,
        }
      ]}
      onPress={!isAlreadySelected ? onPress : undefined}
      activeOpacity={isAlreadySelected ? 1 : 0.7}
      onLongPress={onLongPress}
      delayLongPress={300}
    >
      <View style={styles.leftContainer}>
        <Text style={[
          styles.label, 
          { color: isSelected ? themeColors.accentColor : themeColors.textColor },
          isSelected && { fontWeight: "bold" }
        ]}>
          {label}
        </Text>
        {hint && (
          <Text style={[
            styles.hint, 
            { color: isSelected ? themeColors.accentColor : themeColors.textColor2 }
          ]}>
            {hint}
          </Text>
        )}
      </View>
      
      <View style={styles.rightContainer}>
        {rightContent}
        
        {onEdit && (
          <TouchableOpacity hitSlop={15} onPress={onEdit} style={styles.editButton}>
            <PencilSimple size={20} color={themeColors.textColor2} weight="bold" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { 
    width: 'auto',
    paddingVertical: 14, 
    paddingHorizontal: 16, 
    borderRadius: 12, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 56,
  },
  leftContainer: { 
    flex: 1, 
    justifyContent: 'center' 
  },
  rightContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  label: { 
    fontSize: 16, 
    fontWeight: "500" 
  },
  hint: { 
    fontSize: 12, 
    marginTop: 4, 
    opacity: 0.8,
    fontWeight: "500"
  },
  editButton: { 
    padding: 4 
  },
});