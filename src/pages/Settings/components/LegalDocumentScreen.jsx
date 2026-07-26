import React from "react";
import {
  Alert,
  Animated,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Globe } from "phosphor-react-native";
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import themes from "../../../config/themes";
import { getLegalDocument } from "../../../config/legalDocuments.generated";
import SettingsHeader from "../../../components/ui/SettingsHeader";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { t } from "../../../utils/i18n";
import { triggerHaptic } from "../../../utils/haptics";
import { getLegalDocumentBrowserUrl } from "../../../utils/legalDocumentLinks";

export default function LegalDocumentScreen() {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { global, lang } = useScheduleData();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const document = getLegalDocument(route.params?.documentType);
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const headerHeight = 60 + insets.top;
  const browserUrl = getLegalDocumentBrowserUrl(route.params?.documentType, lang);

  React.useEffect(() => {
    if (Platform.OS !== "web" || !browserUrl) return;

    if (typeof window !== "undefined") {
      window.location.assign(browserUrl);
      return;
    }

    Linking.openURL(browserUrl).catch(() => {});
  }, [browserUrl]);

  const openInBrowser = () => {
    if (!browserUrl) {
      return;
    }

    triggerHaptic("open");
    Linking.openURL(browserUrl).catch(() => {
      Alert.alert(t("common.error", lang), t("settings.about_screen.link_open_failed", lang));
    });
  };

  const renderBlock = (section, block, index) => {
    const key = `${section.title}-${block.type}-${index}`;

    if (block.type === "subheading") {
      return (
        <Text key={key} style={[styles.subheading, { color: themeColors.textColor }]}>
          {block.text}
        </Text>
      );
    }

    if (block.type === "bullet") {
      return (
        <View key={key} style={styles.bulletRow}>
          <Text style={[styles.bulletMark, { color: themeColors.accentColor }]}>
            {"\u2022"}
          </Text>
          <Text style={[styles.bulletText, { color: themeColors.textColor2 }]}>
            {block.text}
          </Text>
        </View>
      );
    }

    if (block.type === "definition") {
      return (
        <View key={key} style={styles.definitionBlock}>
          <Text style={[styles.definitionTerm, { color: themeColors.textColor }]}>
            {block.term}
          </Text>
          <Text style={[styles.paragraph, { color: themeColors.textColor2 }]}>
            {block.text}
          </Text>
        </View>
      );
    }

    if (block.type === "tableRow") {
      return (
        <View
          key={key}
          style={[
            styles.tableRow,
            {
              backgroundColor: themeColors.backgroundColor2,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          {block.cells.map((cell, cellIndex) => (
            <Text
              key={`${key}-cell-${cellIndex}`}
              style={[
                styles.tableCell,
                {
                  color: cellIndex === 0 ? themeColors.textColor : themeColors.textColor2,
                  fontWeight: cellIndex === 0 ? "700" : "500",
                },
              ]}
            >
              {cell}
            </Text>
          ))}
        </View>
      );
    }

    return (
      <Text key={key} style={[styles.paragraph, { color: themeColors.textColor2 }]}>
        {block.text}
      </Text>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.backgroundColor }]}>
      <SettingsHeader
        title={document.title}
        scrollY={scrollY}
        rightButton={(
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("settings.about_screen.open_in_browser", lang)}
            onPress={openInBrowser}
            activeOpacity={0.7}
            style={styles.headerAction}
          >
            <Globe size={24} color={themeColors.accentColor} weight="bold" />
          </TouchableOpacity>
        )}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + 24,
            paddingBottom: Math.max(insets.bottom, 20) + 24,
          },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <Text style={[styles.title, { color: themeColors.textColor }]}>
          {document.title}
        </Text>
        <Text style={[styles.meta, { color: themeColors.textColor2 }]}>
          {document.effectiveDateLine || document.effectiveDate}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("settings.about_screen.open_in_browser", lang)}
          onPress={openInBrowser}
          activeOpacity={0.82}
          style={[
            styles.browserButton,
            {
              backgroundColor: themeColors.accentColorLight,
              borderColor: themeColors.accentColor,
            },
          ]}
        >
          <Globe size={18} color={themeColors.accentColor} weight="bold" />
          <Text
            numberOfLines={1}
            style={[styles.browserButtonText, { color: themeColors.accentColor }]}
          >
            {t("settings.about_screen.open_in_browser", lang)}
          </Text>
        </TouchableOpacity>

        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
              {section.title}
            </Text>
            {(section.blocks || []).map((block, index) => renderBlock(section, block, index))}
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerAction: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: 0,
  },
  meta: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  browserButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
  },
  browserButtonText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  subheading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 16,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 9,
  },
  bulletMark: {
    width: 18,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  bulletText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 22,
  },
  definitionBlock: {
    marginTop: 12,
  },
  definitionTerm: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
  },
  tableRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginTop: 10,
    padding: 12,
  },
  tableCell: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
});
