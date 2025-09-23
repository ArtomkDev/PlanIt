import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useSchedule } from "../../../../context/ScheduleProvider";
import GradientBackground from "../../../../components/GradientBackground";
import GradientEditorModal from "./GradientEditorModal";

export default function GradientPicker({ selected, onSelect, onUpdate , onEdit}) {
  const { schedule } = useSchedule();
  const gradients = schedule?.gradients || [];

  const [editing, setEditing] = useState(null);

  return (
    <>
      <FlatList
        data={gradients}
        keyExtractor={(g) => g.id.toString()}
        numColumns={2}
        renderItem={({ item }) => {
          const isSelected = selected === item.id;

          return (
            <TouchableOpacity
              style={styles.gradientTile}
              onPress={() => onSelect(item.id)}
              onLongPress={() => onEdit?.(item)} // відкриває редактор
              activeOpacity={0.8}
            >
              <GradientBackground
                gradient={item}
                style={StyleSheet.absoluteFillObject}
              />

              {isSelected && <View style={styles.selectedMark} />}
            </TouchableOpacity>
          );
        }}
      />

      {editing && (
        <GradientEditorModal
          visible={!!editing}
          gradient={editing}
          onClose={() => setEditing(null)} // закриває тільки редактор
          onSave={(newGradient) => {
            onUpdate?.(newGradient); // оновлюємо градієнт у списку
            // не закриваємо ColorGradientModal
            setEditing(null); // закриваємо лише сам редактор
          }}
        />
      )}

    </>
  );
}

const styles = StyleSheet.create({
  gradientTile: {
    width: 100,
    height: 50,
    borderRadius: 12,
    margin: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  selectedMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
});
