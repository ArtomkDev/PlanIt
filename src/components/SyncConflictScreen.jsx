import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useSchedule } from '../context/ScheduleProvider';
import { GitBranch, Smartphone, CloudDownload, CopyPlus } from 'lucide-react-native';

export default function SyncConflictScreen() {
  const { conflictQueue, handleResolveConflict } = useSchedule();

  // Якщо конфліктів немає, екран не рендериться взагалі
  if (!conflictQueue || conflictQueue.length === 0) return null;

  return (
    <View style={styles.absoluteOverlay}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <GitBranch color="#FF4D4D" size={48} strokeWidth={1.5} style={styles.headerIcon} />
          <Text style={styles.title}>Конфлікт версій</Text>
          <Text style={styles.subtitle}>
            Виявлено розбіжності між даними на цьому пристрої та в хмарі. Оберіть, які дані застосувати.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {conflictQueue.map((conflict, index) => {
            // ЗАХИСТ: якщо з якоїсь причини об'єкт пошкоджено або ще не довантажився
            const localSch = conflict?.local;
            if (!localSch) return null;

            const localName = localSch.name || "Без назви";
            const conflictId = localSch.id || `conflict-${index}`;

            return (
              <View key={conflictId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.scheduleName}>{localName}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Потребує уваги</Text>
                  </View>
                </View>

                {/* Кнопка 1: Локальна */}
                <Pressable 
                  style={[styles.btn, styles.btnLocal]} 
                  onPress={() => handleResolveConflict(conflictId, 'local')}
                >
                  <View style={styles.btnIconBoxLocal}>
                    <Smartphone color="#1C1C1E" size={20} />
                  </View>
                  <View style={styles.btnTextBox}>
                    <Text style={styles.btnLocalText}>Залишити з цього пристрою</Text>
                    <Text style={styles.btnSubTextDark}>Хмарна версія буде перезаписана</Text>
                  </View>
                </Pressable>

                {/* Кнопка 2: Хмарна */}
                <Pressable 
                  style={[styles.btn, styles.btnCloud]} 
                  onPress={() => handleResolveConflict(conflictId, 'cloud')}
                >
                  <View style={styles.btnIconBoxCloud}>
                    <CloudDownload color="#FFF" size={20} />
                  </View>
                  <View style={styles.btnTextBox}>
                    <Text style={styles.btnCloudText}>Завантажити з хмари</Text>
                    <Text style={styles.btnSubTextLight}>Локальні зміни будуть втрачені</Text>
                  </View>
                </Pressable>

                {/* Кнопка 3: Обидві (Копія) */}
                <Pressable 
                  style={[styles.btn, styles.btnBoth]} 
                  onPress={() => handleResolveConflict(conflictId, 'both')}
                >
                  <View style={styles.btnIconBoxBoth}>
                    <CopyPlus color="#EBEBF5" size={20} />
                  </View>
                  <View style={styles.btnTextBox}>
                    <Text style={styles.btnBothText}>Зберегти обидві (Створити копію)</Text>
                    <Text style={styles.btnSubTextLight}>Локальна версія збережеться як новий розклад</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ГОЛОВНЕ ВИПРАВЛЕННЯ: Абсолютне позиціонування замість Native Modal
  absoluteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 999999, // Гарантовано перекриває всі BottomSheets та інші елементи інтерфейсу
    elevation: 9999,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerIcon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#A8A8B3',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  scheduleName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(255, 77, 77, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FF4D4D',
    fontSize: 12,
    fontWeight: '600',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  btnLocal: {
    backgroundColor: '#32D74B', 
  },
  btnCloud: {
    backgroundColor: '#2C2C2E',
  },
  btnBoth: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderStyle: 'dashed',
  },
  btnIconBoxLocal: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  btnIconBoxCloud: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  btnIconBoxBoth: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  btnTextBox: {
    flex: 1,
  },
  btnLocalText: {
    color: '#1C1C1E',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  btnCloudText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  btnBothText: {
    color: '#EBEBF5',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  btnSubTextDark: {
    color: 'rgba(28, 28, 30, 0.6)',
    fontSize: 12,
  },
  btnSubTextLight: {
    color: '#8E8E93',
    fontSize: 12,
  }
});