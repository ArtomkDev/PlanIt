import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

export default function Header({
	daysOfWeek,
	currentDate,
	getDayIndex,
	themeColors,
}) {
	return (
		<View style={styles.headerContainer}>
			<Text style={[styles.dayOfWeekText, { color: themeColors.textColor }]}>
				{daysOfWeek[getDayIndex(currentDate)]}
			</Text>
			<Text style={[styles.dateText, { color: themeColors.textColor }]}>
				{currentDate.toLocaleDateString('uk-UA')}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	headerContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	dayOfWeekText: { fontSize: 20, fontWeight: 'bold' },
	dateText: { fontSize: 16 },
})
