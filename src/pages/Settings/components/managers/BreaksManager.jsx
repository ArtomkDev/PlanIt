import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSchedule } from '../../../../context/ScheduleProvider';
import themes from '../../../../config/themes';
import { t } from '../../../../utils/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function BreaksManager() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { global, schedule, setScheduleDraft , lang} = useSchedule();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);


  const [tempBreaks, setTempBreaks] = useState(() => schedule.breaks.map(String));
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleBreakChange = (value, index) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setTempBreaks((prev) => {
      const updated = [...prev];
      updated[index] = numericValue;
      return updated;
    });
  };

  const handleAddBreak = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTempBreaks([...tempBreaks, "10"]);
  };

  const handleRemoveBreak = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTempBreaks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const finalBreaks = tempBreaks
      .map(Number)
      .map(n => isNaN(n) || n <= 0 ? 10 : n); 

    setScheduleDraft((prev) => ({ ...prev, breaks: finalBreaks }));
    navigation.goBack();
  };

  const isChanged = JSON.stringify(tempBreaks.map(Number)) !== JSON.stringify(schedule.breaks);

  const tabBarHeightOffset = 50 + insets.bottom + 20;
  const footerPaddingBottom = isKeyboardVisible ? (Platform.OS === 'ios' ? 12 : 20) : tabBarHeightOffset;

  return (
    <View style={[styles.mainContainer, { backgroundColor: themeColors.backgroundColor, paddingTop: insets.top }]}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={15}>
          <Ionicons name="chevron-back" size={28} color={themeColors.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textColor }]}>
          {t('settings.breaks_manager.title', lang)}
        </Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <View style={styles.listContent}>
            {tempBreaks.map((item, index) => (
              <View 
                key={`break-${index}`} 
                style={[styles.card, { backgroundColor: themeColors.backgroundColor2 }]}
              >
                <View style={styles.cardLeft}>
                  <Ionicons name="time-outline" size={22} color={themeColors.accentColor} style={styles.cardIcon} />
                  <Text style={[styles.cardTitle, { color: themeColors.textColor }]}>
                    {t('settings.breaks_manager.break_item', lang)} {index + 1}
                  </Text>
                </View>

                <View style={styles.cardRight}>
                  <TextInput
                    style={[
                      styles.input, 
                      { 
                        color: themeColors.textColor,
                        backgroundColor: isKeyboardVisible ? themeColors.backgroundColor : 'transparent'
                      }
                    ]}
                    keyboardType="number-pad"
                    value={item}
                    onChangeText={(val) => handleBreakChange(val, index)}
                    maxLength={3}
                    selectTextOnFocus
                  />
                  <Text style={[styles.minutesText, { color: themeColors.textColor2 }]}>
                    {t('settings.breaks_manager.minutes', lang)}
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.deleteBtn} 
                    onPress={() => handleRemoveBreak(index)}
                    hitSlop={10}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity 
              style={[
                styles.actionButton, 
                { borderColor: themeColors.accentColor, borderStyle: 'dashed' }
              ]} 
              onPress={handleAddBreak}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={22} color={themeColors.accentColor} style={{ marginRight: 6 }} />
              <Text style={[styles.actionButtonText, { color: themeColors.accentColor }]}>
                {t('settings.breaks_manager.add_btn', lang)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, minHeight: 40 }} />

          <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
            <TouchableOpacity 
                style={[styles.button, styles.cancelButton, { backgroundColor: themeColors.backgroundColor2 }]} 
                onPress={() => navigation.goBack()}
            >
              <Text style={[styles.buttonText, { color: themeColors.textColor }]}>
                {t('common.cancel', lang)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.saveButton, 
                  { 
                    backgroundColor: isChanged ? themeColors.accentColor : themeColors.backgroundColor2,
                    opacity: isChanged ? 1 : 0.6
                  }
                ]} 
                onPress={handleSave}
                disabled={!isChanged}
            >
              <Text style={[
                styles.saveButtonText, 
                { color: isChanged ? "#fff" : themeColors.textColor2 }
              ]}>
                {t('common.save', lang)}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1, 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 12, 
    paddingVertical: 14 
  },
  backButton: { 
    width: 40, 
    alignItems: 'flex-start' 
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700' 
  },
  scrollContent: { 
    flexGrow: 1, 
    paddingTop: 16 
  },
  listContent: {
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 40,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  minutesText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
    marginRight: 16,
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: '#FF3B3015',
    borderRadius: 8,
  },
  actionButton: {
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    borderWidth: 1,
    marginTop: 4,
  },
  actionButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
  footer: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    gap: 12, 
    paddingHorizontal: 16,
    marginTop: 20 
  },
  button: { 
    flex: 1, 
    height: 50, 
    borderRadius: 14, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  cancelButton: { 
    borderWidth: 0 
  },
  saveButton: { 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 2 
  },
  buttonText: { 
    fontSize: 16, 
    fontWeight: "600" 
  },
  saveButtonText: { 
    fontSize: 16, 
    fontWeight: "700" 
  },
});