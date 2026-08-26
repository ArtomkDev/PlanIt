import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity
} from 'react-native';
import { CloudArrowUp, CheckSquare, Square } from 'phosphor-react-native';

import { saveSchedule } from '../../config/firestore';
import { generateId } from '../../utils/idGenerator';
import { getLocalSchedule, saveLocalSchedule } from '../../utils/storage';
import {
  consumeCloudMigrationOffers,
  finalizeCloudMigration,
  getPendingCloudMigrationSchedules,
  markScheduleAsAccountOwned,
} from '../../utils/scheduleOwnership';
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
  const [migrationTargetIds, setMigrationTargetIds] = useState({});
  const committedTargetIdsRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    setIsVisible(false);
    setLocalSchedules([]);
    setSelectedIds(new Set());
    setLocalDataFull(null);
    setMigrationTargetIds({});
    committedTargetIdsRef.current = new Set();

    const checkLocalData = async () => {
      if (!userId) return;
      try {
        const localData = await getLocalSchedule(null);
        if (cancelled) return;
        const needsMigration = getPendingCloudMigrationSchedules(localData);
        if (needsMigration.length === 0) {
          onComplete();
          return;
        }

        // Consume the offer before showing it. Closing, skipping, signing out,
        // or an app crash must never make the same schedule prompt again.
        const consumedData = consumeCloudMigrationOffers(localData);
        await saveLocalSchedule(consumedData, null);
        if (cancelled) return;

        setLocalDataFull(consumedData);
        setLocalSchedules(needsMigration);
        setSelectedIds(new Set(needsMigration.map((schedule) => schedule.id)));
        setMigrationTargetIds(Object.fromEntries(
          needsMigration.map((schedule) => [schedule.id, generateId()]),
        ));
        setIsVisible(true);
      } catch (error) {
        console.warn('Migration check error:', error);
        onComplete();
      }
    };

    checkLocalData();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  const handleSkip = () => {
    triggerHaptic("warning");
    setIsVisible(false);
    onComplete();
  };

  const handleMigrate = async () => {
    if (selectedIds.size === 0) {
      handleSkip();
      return;
    }

    triggerHaptic("selection");
    setIsMigrating(true);
    try {
      const selectedSourceIds = [...selectedIds];
      const schedulesToMigrate = localSchedules.filter(
        (schedule) => selectedIds.has(schedule.id),
      );
      const pendingCopies = schedulesToMigrate
        .map((localSchedule) => {
          const copy = markScheduleAsAccountOwned(
            JSON.parse(JSON.stringify(localSchedule)),
          );
          copy.id = migrationTargetIds[localSchedule.id] || generateId();
          copy.version = 0;
          copy.baseVersion = 0;
          copy.lastSynced = 0;
          copy.lastModified = Date.now();
          return copy;
        })
        .filter((copy) => !committedTargetIdsRef.current.has(copy.id));

      for (let index = 0; index < pendingCopies.length; index += 400) {
        const batch = pendingCopies.slice(index, index + 400);
        try {
          const committed = await saveSchedule(
            userId,
            { schedules: batch },
            true,
          );
          (committed?.schedules || []).forEach((schedule) => {
            committedTargetIdsRef.current.add(schedule.id);
          });
        } catch (cloudError) {
          (cloudError?.committed?.schedules || []).forEach((schedule) => {
            committedTargetIdsRef.current.add(schedule.id);
          });
          throw cloudError;
        }
      }

      const allSelectedWereCommitted = schedulesToMigrate.every((schedule) => (
        committedTargetIdsRef.current.has(migrationTargetIds[schedule.id])
      ));
      if (!allSelectedWereCommitted) {
        throw new Error('Not all selected schedules were transferred.');
      }

      const finalizedLocalData = finalizeCloudMigration(
        localDataFull,
        new Set(selectedSourceIds),
        Date.now(),
      );
      await saveLocalSchedule(finalizedLocalData, null);
      setLocalDataFull(finalizedLocalData);
      setIsVisible(false);
      triggerHaptic("success");
      onComplete();
    } catch (err) {
      triggerHaptic("error");
      console.warn('Migration error:', err);
      // Target ids and committed ids survive retries in this session, so a
      // partial cloud write can be completed without creating duplicates.
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
