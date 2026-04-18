import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GitBranch, DeviceMobile, CloudArrowDown, Copy, CaretRight } from 'phosphor-react-native';
import useSystemThemeColors from '../../hooks/useSystemThemeColors';
import AppBlur from '../../components/ui/AppBlur';
import { t } from '../../utils/i18n';

export default function SyncConflictScreen({ 
  conflictQueue, 
  handleResolveConflict, 
  lang = 'uk' 
}) {
  const { colors } = useSystemThemeColors();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(200);

  if (!conflictQueue?.length) return null;

  const ActionButton = ({ icon: Icon, title, subtitle, onPress, type }) => {
    const getBgColor = () => {
      if (type === 'local') return colors.accentColor;
      if (type === 'cloud') return colors.backgroundColor3;
      return 'transparent';
    };

    return (
      <Pressable 
        style={({ pressed }) => [
          styles.actionBtn, 
          { 
            backgroundColor: getBgColor(),
            opacity: pressed ? 0.85 : 1 
          },
          type === 'both' && { 
            borderStyle: 'dashed', 
            borderWidth: 1, 
            borderColor: colors.borderColor 
          }
        ]} 
        onPress={onPress}
      >
        <View style={styles.actionIconWrapper}>
          <Icon color={type === 'local' ? colors.textOnAccent : colors.textColor} size={20} weight="fill" />
        </View>
        <View style={styles.actionTextContent}>
          <Text style={[styles.actionTitle, { color: type === 'local' ? colors.textOnAccent : colors.textColor }]}>
            {title}
          </Text>
          <Text style={[styles.actionSubtitle, { color: type === 'local' ? 'rgba(255,255,255,0.7)' : colors.textColor2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <CaretRight size={16} color={type === 'local' ? colors.textOnAccent : colors.textColor3} weight="bold" />
      </Pressable>
    );
  };

  return (
    <View style={[styles.absoluteOverlay, { backgroundColor: colors.backgroundColor }]} pointerEvents="auto">
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: headerHeight + 16, 
            paddingBottom: Math.max(insets.bottom, 24) + 40 
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {conflictQueue.map((conflict, index) => {
          const localSch = conflict?.local;
          if (!localSch) return null;

          const localName = localSch.name || t('sync_conflict.untitled', lang);
          const conflictId = localSch.id || `conflict-${index}`;

          return (
            <View key={conflictId} style={[styles.card, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.scheduleName, { color: colors.textColor }]} numberOfLines={1}>
                  {localName}
                </Text>
              </View>

              <View style={styles.actionsGap}>
                <ActionButton 
                  type="local"
                  icon={DeviceMobile}
                  title={t('sync_conflict.this_device', lang)}
                  subtitle={t('sync_conflict.overwrite_cloud', lang)}
                  onPress={() => handleResolveConflict(conflictId, 'local')}
                />
                
                <ActionButton 
                  type="cloud"
                  icon={CloudArrowDown}
                  title={t('sync_conflict.cloud_copy', lang)}
                  subtitle={t('sync_conflict.delete_local', lang)}
                  onPress={() => handleResolveConflict(conflictId, 'cloud')}
                />

                <ActionButton 
                  type="both"
                  icon={Copy}
                  title={t('sync_conflict.keep_both', lang)}
                  subtitle={t('sync_conflict.create_duplicate', lang)}
                  onPress={() => handleResolveConflict(conflictId, 'both')}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View 
        style={[
          styles.absoluteHeader, 
          { 
            borderBottomColor: colors.borderColor,
            backgroundColor: Platform.OS === 'android' ? colors.backgroundColor : 'transparent' 
          }
        ]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {Platform.OS !== 'android' && (
          <>
            <AppBlur intensity={80} style={[StyleSheet.absoluteFill, { zIndex: -1 }]} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backgroundColor, opacity: 0.65, zIndex: -1 }]} />
          </>
        )}
        
        <View style={[styles.headerContent, { paddingTop: Math.max(insets.top, 16) + 20 }]}>
          <View style={[styles.iconBadge, { backgroundColor: colors.accentColorLight }]}>
            <GitBranch color={colors.accentColor} size={32} weight="bold" />
          </View>
          <Text style={[styles.title, { color: colors.textColor }]}>
            {t('sync_conflict.title', lang)}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textColor2 }]}>
            {t('sync_conflict.subtitle', lang)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 999,
  },
  absoluteHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerContent: { 
    paddingHorizontal: 30, 
    paddingBottom: 20, 
    alignItems: 'center' 
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { 
    fontSize: 22, 
    fontWeight: '800', 
    marginBottom: 8, 
    textAlign: 'center',
    letterSpacing: -0.5
  },
  subtitle: { 
    fontSize: 14, 
    textAlign: 'center', 
    lineHeight: 20,
    paddingHorizontal: 10
  },
  scrollContent: { 
    paddingHorizontal: 16, 
  },
  card: { 
    borderRadius: 24, 
    padding: 12, 
    marginBottom: 12, 
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12,
    paddingHorizontal: 4
  },
  scheduleName: { 
    fontSize: 16, 
    fontWeight: '700', 
    flex: 1,
    marginRight: 8
  },
  actionsGap: {
    gap: 8, 
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    height: 56,
  },
  actionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionTextContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  }
});