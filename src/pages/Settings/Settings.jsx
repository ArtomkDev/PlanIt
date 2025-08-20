import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import AutoSaveIntervalSettings from './components/AutoSaveIntervalSettings'
import SignOutButton from './components/SignOutButton'
import ThemeSettings from './components/ThemeSettings'

const Settings = ({
	themeColors,
}) => {
	return (
		<View
			style={[
				styles.container,
				{ backgroundColor: themeColors.backgroundColor },
			]}
		>
			<Text style={[styles.title, { color: themeColors.textColor }]}>
				Налаштування акаунту
			</Text>

			<AutoSaveIntervalSettings/>

			<ThemeSettings/>

			<SignOutButton />
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	title: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 20,
	},
})

export default Settings
