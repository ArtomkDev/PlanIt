import React from 'react';
import { View, StyleSheet } from 'react-native';
import BreaksManager from '../components/BreaksManager';

export default function BreaksScreen({ schedule, setSchedule, onDataChange, themeColors, accent }) {
    return (
        <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
            <BreaksManager
                breaks={schedule.breaks}
                setBreaks={(breaks) => {
                    const updatedSchedule = { ...schedule, breaks };
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
        padding: 0,
    },
});
