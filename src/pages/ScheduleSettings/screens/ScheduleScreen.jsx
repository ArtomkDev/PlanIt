import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScheduleManager from '../components/ScheduleManager';

export default function ScheduleScreen({ schedule, setSchedule, onDataChange, themeColors, accent }) {
    return (
        <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
            <ScheduleManager
                schedule={schedule}
                setSchedule={(updatedSchedule) => {
                    setSchedule(updatedSchedule);
                    onDataChange(updatedSchedule);
                }}
                subjects={schedule.subjects}
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
