import React from 'react';
import { View, StyleSheet } from 'react-native';
import SubjectsManager from '../components/SubjectsManager';

export default function SubjectsScreen({ schedule, setSchedule, onDataChange, themeColors, accent }) {
    return (
        <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
            <SubjectsManager
                subjects={schedule.subjects}
                setSubjects={(updatedSubjects) => {
                    const updatedSchedule = { ...schedule, subjects: updatedSubjects };
                    setSchedule(updatedSchedule);
                    onDataChange(updatedSchedule);
                }}
                onAddSubject={(newSubject) => {
                    const updatedSubjects = [...schedule.subjects, { ...newSubject, id: Date.now() }];
                    const updatedSchedule = { ...schedule, subjects: updatedSubjects };
                    setSchedule(updatedSchedule);
                    onDataChange(updatedSchedule);
                }}
                teachers={schedule.teachers}
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
