import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import AutoSaveIntervalSettings from './components/AutoSaveIntervalSettings'
import SignOutButton from './components/SignOutButton'
import ThemeSettings from './components/ThemeSettings'

const Settings = ({
	autoSaveInterval,
	handleAutoSaveIntervalChange,
	theme, // Передаємо тему як пропс
	onThemeChange,
	themeColors, // Оброблені кольори для теми
	accent, // Акцентний колір
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

			<AutoSaveIntervalSettings
				autoSaveInterval={autoSaveInterval}
				onIntervalChange={handleAutoSaveIntervalChange}
				themeColors={themeColors} 
				accent={accent} 
			/>

			<ThemeSettings
				currentTheme={theme}
				onThemeChange={onThemeChange}
				themeColors={themeColors}
				accent={accent} 
			/>

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
