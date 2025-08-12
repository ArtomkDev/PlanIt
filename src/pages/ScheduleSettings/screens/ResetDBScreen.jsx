import React from 'react';
import { View, StyleSheet } from 'react-native';
import ResetDB from '../components/ResetDB';

export default function ResetDBScreen() {
    return (
        <View style={styles.container}>
            <ResetDB />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 10,
    },
});
