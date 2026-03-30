import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';

import { auth } from '../../../../firebase';
import { useSchedule } from '../../../context/ScheduleProvider';
import themes from '../../../config/themes';
import { t } from '../../../utils/i18n';
import SettingsScreenLayout from '../SettingsScreenLayout';

export default function AccountSettings() {
  const { global, user: contextUser, lang } = useSchedule();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const activeUser = isFocused ? auth.currentUser : contextUser;

  const SettingsRow = ({ icon, title, value, rightElement, isLast, isDestructive, onPress }) => {
    const Component = onPress ? TouchableOpacity : View;
    
    return (
      <Component 
        style={[styles.row, !isLast && styles.rowBorder]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.rowLeft}>
          {icon && (
            <View style={[styles.iconContainer, isDestructive && styles.destructiveIconContainer]}>
              <Ionicons name={icon} size={20} color={isDestructive ? '#FF3B30' : themeColors.accentColor} />
            </View>
          )}
          <Text style={[styles.rowTitle, isDestructive && styles.destructiveText]}>{title}</Text>
        </View>
        
        <View style={styles.rowRight}>
          {value && <Text style={styles.rowValue}>{value}</Text>}
          {rightElement}
        </View>
      </Component>
    );
  };

  const userName = activeUser?.displayName || t('settings.account_settings.not_specified', lang);
  const userEmail = activeUser?.email || t('settings.account_settings.not_specified', lang);
  const userPhone = activeUser?.phoneNumber || t('settings.account_settings.not_specified', lang);
  
  const initial = userName !== t('settings.account_settings.not_specified', lang) 
    ? userName.charAt(0).toUpperCase() 
    : '?';

  return (
    <SettingsScreenLayout contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userEmail}>{userEmail}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t('settings.account_settings.info_section', lang)}</Text>
      <View style={styles.section}>
        <SettingsRow 
          icon="person-outline" 
          title={t('settings.account_settings.name', lang)} 
          value={userName} 
          rightElement={<Ionicons name="chevron-forward" size={20} color={themeColors.textColor2} />}
          onPress={() => navigation.navigate('ChangeName')}
        />
        
        <SettingsRow 
          icon="mail-outline" 
          title={t('settings.account_settings.email', lang)} 
          value={userEmail} 
          rightElement={<Ionicons name="chevron-forward" size={20} color={themeColors.textColor2} />}
          onPress={() => navigation.navigate('ChangeEmail')}
        />

        <SettingsRow icon="call-outline" title={t('settings.account_settings.phone', lang)} value={userPhone} isLast />
      </View>

      <Text style={styles.sectionTitle}>{t('settings.account_settings.linked_accounts_section', lang)}</Text>
      <View style={styles.section}>
        <SettingsRow 
          icon="logo-google" 
          title="Google" 
          rightElement={<Text style={styles.linkedStatus}>{t('settings.account_settings.linked', lang)}</Text>}
        />
        <SettingsRow 
          icon="logo-apple" 
          title="Apple" 
          rightElement={
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkButtonText}>{t('settings.account_settings.link_btn', lang)}</Text>
            </TouchableOpacity>
          }
          isLast
        />
      </View>

      <Text style={styles.sectionTitle}>{t('settings.account_settings.security_section', lang)}</Text>
      <View style={styles.section}>
        <SettingsRow 
          icon="lock-closed-outline" 
          title={t('settings.account_settings.password', lang)} 
          value="••••••••" 
          rightElement={<Ionicons name="chevron-forward" size={20} color={themeColors.textColor2} />}
          onPress={() => navigation.navigate('ChangePassword')}
        />
      </View>

      <Text style={styles.sectionTitle}>{t('settings.account_settings.management_section', lang)}</Text>
      <View style={styles.section}>
        <SettingsRow 
          icon="trash-outline" 
          title={t('settings.account_settings.delete_account', lang)} 
          isLast 
          isDestructive 
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      </View>
    </SettingsScreenLayout>
  );
}

const getStyles = (themeColors) => StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: themeColors.accentColor,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: themeColors.accentColor,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' },
  userName: { fontSize: 22, fontWeight: '700', color: themeColors.textColor, marginBottom: 4 },
  userEmail: { fontSize: 14, color: themeColors.textColor2 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: themeColors.textColor2, marginLeft: 16, marginBottom: 8, marginTop: 24, letterSpacing: 0.5 },
  section: {
    backgroundColor: themeColors.backgroundColor2,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: themeColors.borderColor, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, minHeight: 56 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.borderColor },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(150, 150, 150, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  destructiveIconContainer: { backgroundColor: 'rgba(255, 59, 48, 0.1)' },
  rowTitle: { fontSize: 16, color: themeColors.textColor, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 16, color: themeColors.textColor2, marginRight: 8 },
  linkedStatus: { fontSize: 14, color: themeColors.textColor2, fontWeight: '500' },
  linkButton: { backgroundColor: themeColors.accentColor, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  linkButtonText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  centerRow: { justifyContent: 'center' },
  actionText: { fontSize: 16, color: themeColors.accentColor, fontWeight: '500' },
  destructiveText: { color: '#FF3B30' },
});