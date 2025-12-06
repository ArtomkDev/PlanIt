import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/GradientBackground";
import AppBlur from "../../../components/AppBlur"; // Використовуємо ваш компонент блюру
import { getIconComponent } from "../../../config/subjectIcons";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LessonViewer({ visible, lesson, onClose, onEdit }) {
  const { schedule, global } = useSchedule();
  
  if (!visible || !lesson) return null;

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  // Отримуємо повні дані про предмет
  const subjectId = lesson.subject?.id || lesson.subjectId;
  const fullSubject = schedule.subjects.find(s => s.id === subjectId) || lesson.subject || {};

  // --- Викладачі (обробка масиву ID) ---
  const teacherIds = Array.isArray(fullSubject.teachers) 
    ? fullSubject.teachers 
    : (fullSubject.teacher ? [fullSubject.teacher] : []); // Фолбек для старої структури
    
  const associatedTeachers = schedule.teachers.filter(t => teacherIds.includes(t.id));

  // --- Посилання (обробка масиву ID) ---
  const linkIds = Array.isArray(fullSubject.links) ? fullSubject.links : [];
  const associatedLinks = schedule.links.filter(l => linkIds.includes(l.id));

  // --- Градієнт/Колір ---
  const getHeaderBackground = () => {
    if (fullSubject.typeColor === "gradient" && fullSubject.colorGradient) {
      const grad = schedule.gradients.find(g => g.id === fullSubject.colorGradient);
      if (grad) return <GradientBackground gradient={grad} style={styles.headerBackground} />;
    }
    const color = themes.accentColors[fullSubject.color] || themeColors.accentColor;
    return <View style={[styles.headerBackground, { backgroundColor: color }]} />;
  };

  const MainIcon = getIconComponent(fullSubject.icon);

  // --- Дії ---
  const handleLinkPress = async (url) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
    else alert(`Не вдалося відкрити посилання: ${url}`);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Задній фон натискається для закриття */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.modalContainer, { backgroundColor: themeColors.backgroundColor }]}>
          
          {/* Хедер з кольором/градієнтом */}
          <View style={styles.headerContainer}>
            {getHeaderBackground()}
            
            <View style={styles.headerContent}>
              <View style={styles.iconCircle}>
                 <MainIcon size={32} color={themeColors.backgroundColor} />
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.contentScroll} contentContainerStyle={{paddingBottom: 40}}>
            
            {/* Заголовок та Тип */}
            <View style={styles.titleSection}>
              {fullSubject.type && (
                <View style={[styles.typeBadge, { borderColor: themeColors.accentColor }]}>
                  <Text style={[styles.typeText, { color: themeColors.accentColor }]}>
                    {fullSubject.type.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.subjectName, { color: themeColors.textColor }]}>
                {fullSubject.name || "Без назви"}
              </Text>
              {fullSubject.fullName && (
                <Text style={[styles.subjectFullName, { color: themeColors.textColor2 }]}>
                  {fullSubject.fullName}
                </Text>
              )}
            </View>

            <View style={[styles.separator, { backgroundColor: themeColors.borderColor }]} />

            {/* Час та Місце */}
            <View style={styles.gridRow}>
              <View style={[styles.gridItem, { backgroundColor: themeColors.backgroundColor2 }]}>
                <Ionicons name="time-outline" size={22} color={themeColors.accentColor} />
                <View style={styles.gridTextContainer}>
                  <Text style={[styles.gridLabel, { color: themeColors.textColor2 }]}>Час</Text>
                  <Text style={[styles.gridValue, { color: themeColors.textColor }]}>
                    {lesson.timeInfo?.start} - {lesson.timeInfo?.end}
                  </Text>
                </View>
              </View>

              <View style={[styles.gridItem, { backgroundColor: themeColors.backgroundColor2 }]}>
                <Ionicons name="location-outline" size={22} color={themeColors.accentColor} />
                <View style={styles.gridTextContainer}>
                  <Text style={[styles.gridLabel, { color: themeColors.textColor2 }]}>Аудиторія</Text>
                  <Text style={[styles.gridValue, { color: themeColors.textColor }]} numberOfLines={1}>
                    {fullSubject.building ? `${fullSubject.building}, ` : ""}{fullSubject.room || "—"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Викладачі */}
            {associatedTeachers.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>ВИКЛАДАЧІ</Text>
                {associatedTeachers.map((teacher, index) => (
                  <View key={index} style={[styles.rowCard, { backgroundColor: themeColors.backgroundColor2 }]}>
                    <View style={[styles.rowIcon, { backgroundColor: themeColors.backgroundColor3 }]}>
                      <Ionicons name="person" size={18} color={themeColors.textColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: themeColors.textColor }]}>{teacher.name}</Text>
                      {teacher.phone ? <Text style={[styles.rowSubtitle, { color: themeColors.textColor2 }]}>{teacher.phone}</Text> : null}
                    </View>
                    {/* Кнопка подзвонити, якщо є телефон */}
                    {teacher.phone && (
                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${teacher.phone}`)}>
                            <Ionicons name="call-outline" size={22} color={themeColors.accentColor} style={{marginRight: 8}}/>
                        </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Посилання */}
            {associatedLinks.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>МАТЕРІАЛИ</Text>
                {associatedLinks.map((link, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.rowCard, { backgroundColor: themeColors.backgroundColor2 }]}
                    onPress={() => handleLinkPress(link.url)}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: themeColors.backgroundColor3 }]}>
                      <Ionicons name="link" size={18} color={themeColors.accentColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: themeColors.accentColor, textDecorationLine: 'underline' }]}>
                        {link.name || "Посилання"}
                      </Text>
                      <Text style={[styles.rowSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
                        {link.url}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={20} color={themeColors.textColor2} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </ScrollView>

          {/* Кнопки знизу */}
          <View style={[styles.footer, { borderTopColor: themeColors.borderColor }]}>
            <TouchableOpacity 
                style={[styles.editButton, { backgroundColor: themeColors.accentColor }]}
                onPress={() => {
                    onClose();
                    // Передаємо індекс уроку, щоб редактор знав, яку клітинку ми правимо
                    onEdit({ ...lesson, subject: fullSubject, index: lesson.index });
                }}
            >
                <Ionicons name="create-outline" size={20} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.editButtonText}>Редагувати</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.75, // Займає 75% екрану
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0px -5px 20px rgba(0,0,0,0.2)' },
      default: { elevation: 10 }
    })
  },
  headerContainer: {
    height: 100,
    position: 'relative',
    justifyContent: 'flex-end',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    position: 'absolute',
    bottom: -25, // Іконка виступає вниз
    left: 20,
    right: 20,
    zIndex: 2,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4,
  },
  closeBtn: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 8,
    borderRadius: 20,
    marginBottom: 35, // Піднімаємо хрестик вище
  },
  contentScroll: {
    flex: 1,
    paddingTop: 40, // Відступ під іконку
    paddingHorizontal: 20,
  },
  titleSection: {
    marginBottom: 20,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subjectName: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 32,
  },
  subjectFullName: {
    fontSize: 15,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    width: '100%',
    marginBottom: 20,
    opacity: 0.5,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  gridItem: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gridTextContainer: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1,
    marginLeft: 4,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
  },
  editButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});