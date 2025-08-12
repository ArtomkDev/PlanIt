import React from 'react';
import { View, StyleSheet } from 'react-native';
import TeachersManager from '../components/TeachersManager';

export default function TeachersScreen({ schedule, setSchedule, onDataChange, themeColors, accent }) {
    return (
        <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
            <TeachersManager
                teachers={schedule.teachers}
                setTeachers={(updatedTeachers) => {
                    const updatedSchedule = { ...schedule, teachers: updatedTeachers };
                    setSchedule(updatedSchedule);
                    onDataChange(updatedSchedule);
                }}
                onAddTeacher={(newTeacher) => {
                    const updatedTeachers = [...schedule.teachers, { ...newTeacher, id: Date.now() }];
                    const updatedSchedule = { ...schedule, teachers: updatedTeachers };
                    setSchedule(updatedSchedule);
                    onDataChange(updatedSchedule);
                }}
                themeColors={themeColors}
                accent={accent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
    },
});
