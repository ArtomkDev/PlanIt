import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity
} from 'react-native';
import { CloudArrowUp, CheckSquare, Square } from 'phosphor-react-native';

import { saveSchedule } from '../../config/firestore';
import { generateId } from '../../utils/idGenerator';
import { getLocalSchedule, saveLocalSchedule } from '../../utils/storage';
import { useScheduleData } from '../../context/ScheduleProvider';
import themes from '../../config/themes';
import { t } from '../../utils/i18n';
import MorphingLoader from '../ui/MorphingLoader';
import BottomSheet, { SheetFlatList } from '../ui/BottomSheet';
import { triggerHaptic } from '../../utils/haptics';

export default function MigrationModal({ userId, onComplete = () => {} }) {
  const { global, lang } = useScheduleData();
  
  const [currentTheme, currentAccent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(currentTheme, currentAccent);

  const [isVisible, setIsVisible] = useState(false);
  const [localSchedules, setLocalSchedules] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isMigrating, setIsMigrating] = useState(false);
  const [localDataFull, setLocalDataFull] = useState(null);

  useEffect(() => {
    if (userId) {
      checkLocalData();
    }
  }, [userId]);

  const checkLocalData = async () => {
    try {
      const localData = await getLocalSchedule(null);
      if (!localData) {
        onComplete();
        return;
      }
      setLocalDataFull(localData);

      const schedules = localData.schedules || [];
      const needsMigration = schedules.filter(s => !s.isCloud && !s.isDeleted);

      if (needsMigration.length > 0) {
        setLocalSchedules(needsMigration);
        setSelectedIds(new Set(needsMigration.map(s => s.id)));
        setIsVisible(true);
      } else {
        onComplete();
      }
    } catch (error) {
      console.warn('Migration check error:', error);
      onComplete();
    }
  };

  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      triggerHaptic("toggleOff");
      newSelected.delete(id);
    } else {
      triggerHaptic("toggleOn");
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSkip = async () => {
    triggerHaptic("warning");
    try {
      if (localDataFull) {
        const updatedLocalSchedules = (localDataFull.schedules || []).map(s => ({
          ...s,
          isCloud: true
        }));
        
        await saveLocalSchedule({
          ...localDataFull,
          schedules: updatedLocalSchedules
        }, null);
      }
    } catch (error) {
      console.warn('Skip migration error:', error);
    } finally {
      setIsVisible(false);
      onComplete();
    }
  };

  const handleMigrate = async () => {
    if (selectedIds.size === 0) {
      await handleSkip();
      return;
    }

    triggerHaptic("selection");
    setIsMigrating(true);
    try {
      const schedulesToMigrate = localSchedules.filter(s => selectedIds.has(s.id));
      const mergedSchedules = schedulesToMigrate.map((ls) => {
        const copy = JSON.parse(JSON.stringify(ls));
        copy.isCloud = true;
        // Always allocate a new cloud id. A collision must never overwrite an
        // unrelated schedule created on another device.
        copy.id = generateId();
        copy.version = 0;
        copy.baseVersion = 0;
        copy.lastSynced = 0;
        copy.lastModified = Date.now();
        return copy;
      });
      await saveSchedule(userId, { schedules: mergedSchedules }, true);

      const updatedLocalSchedules = (localDataFull.schedules || []).map(s => {
        return selectedIds.has(s.id) ? { ...s, isCloud: true } : s;
      });

      await saveLocalSchedule({
        ...localDataFull,
        schedules: updatedLocalSchedules
      }, null);

      setIsVisible(false);
      triggerHaptic("success");
      onComplete();
    } catch (err) {
      triggerHaptic("error");
      console.warn('Migration error:', err);
      // Keep the sheet open so a transient network/conflict error is retryable.
      setIsVisible(true);
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <BottomSheet
      visible={isVisible}
      onClose={handleSkip}
      snapPoints={["58%", "82%"]}
      initialSnapIndex={0}
      maxWidth={600}
      backgroundColor={themeColors.backgroundColor}
      handleColor={themeColors.textColor3}
      closeOnBackdropPress={false}
      enablePanDownToClose={false}
      accessibilityLabel={t('migration_modal.title', lang)}
      closeAccessibilityLabel={t('common.close', lang)}
      testID="migration-sheet"
      contentStyle={styles.container}
    >
          <View style={[styles.iconContainer, { backgroundColor: themeColors.accentColor + '20' }]}>
            <CloudArrowUp size={40} color={themeColors.accentColor} weight="fill" />
          </View>
          
          <Text style={[styles.title, { color: themeColors.textColor }]}>
            {t('migration_modal.title', lang)}
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textColor2 }]}>
            {t('migration_modal.subtitle', lang)}
          </Text>

          <View style={styles.listContainer}>
            <SheetFlatList
              data={localSchedules}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <TouchableOpacity 
                    style={[
                      styles.scheduleItem, 
                      { backgroundColor: themeColors.backgroundColor2 },
                      isSelected && { borderColor: themeColors.accentColor, backgroundColor: themeColors.accentColor + '15' }
                    ]}
                    onPress={() => toggleSelection(item.id)}
                    activeOpacity={0.7}
                  >
                    {isSelected ? (
                      <CheckSquare size={24} color={themeColors.accentColor} weight="fill" />
                    ) : (
                      <Square size={24} color={themeColors.textColor2} weight="regular" />
                    )}
                    <Text style={[styles.scheduleName, { color: themeColors.textColor }]} numberOfLines={1}>
                      {item.name || t('migration_modal.untitled', lang)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: themeColors.backgroundColor2 }]} 
              onPress={handleSkip}
              disabled={isMigrating}
            >
              <Text style={[styles.skipButtonText, { color: themeColors.textColor }]}>
                {t('migration_modal.skip', lang)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: themeColors.accentColor }]} 
              onPress={handleMigrate}
              disabled={isMigrating || selectedIds.size === 0}
            >
              {isMigrating ? (
                <MorphingLoader size={24} />
              ) : (
                <Text style={styles.migrateButtonText}>
                  {t('migration_modal.migrate', lang)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  listContainer: {
    width: '100%',
    maxHeight: 200,
    marginBottom: 24,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scheduleName: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  migrateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
