import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import themes from '../../../config/themes'

const ThemeSettings = ({
	currentTheme,
	onThemeChange,
	themeColors,
	accent,
}) => {
	const [selectedMode, setSelectedMode] = useState(currentTheme[0])
	const [selectedColor, setSelectedColor] = useState(currentTheme[1])

	// Оновлюємо тему при кожній зміні вибору
	useEffect(() => {
		if (currentTheme[0] !== selectedMode || currentTheme[1] !== selectedColor) {
			onThemeChange([selectedMode, selectedColor])
		}
	}, [selectedMode, selectedColor])

	const renderColorOption = colorName => {
		const colorValue = themes.accentColors[colorName]

		return (
			<TouchableOpacity
				key={colorName}
				style={[
					styles.colorOption,
					{ backgroundColor: colorValue },
					selectedColor === colorName && {
						...styles.selectedColor,
						borderColor: themeColors.textColor2,
					},
				]}
				onPress={() => setSelectedColor(colorName)}
			/>
		)
	}

	return (
		<View style={styles.container}>
			<Text style={[styles.title, { color: themeColors.textColor }]}>
				Виберіть тему
			</Text>
			<View style={styles.themeContainer}>
				<TouchableOpacity
					style={[
						styles.themeButton,
						{
							backgroundColor: themeColors.backgroundColor2,
						},
						selectedMode === 'dark' && {
							...styles.selectedTheme,
							backgroundColor: accent,
						},
					]}
					onPress={() => setSelectedMode('dark')}
				>
					<Text
						style={[styles.themeButtonText, { color: themeColors.textColor }]}
					>
						Темна
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[
						styles.themeButton,
						{
							backgroundColor: themeColors.backgroundColor2,
						},
						selectedMode === 'light' && {
							...styles.selectedTheme,
							backgroundColor: accent,
						},
					]}
					onPress={() => setSelectedMode('light')}
				>
					<Text
						style={[styles.themeButtonText, { color: themeColors.textColor }]}
					>
						Світла
					</Text>
				</TouchableOpacity>
			</View>

			<Text style={[styles.title, { color: themeColors.textColor }]}>
				Виберіть колір
			</Text>
			<View style={styles.colorsContainer}>
				{Object.keys(themes.accentColors).map(colorName =>
					renderColorOption(colorName)
				)}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		marginBottom: 20,
		padding: 20,
	},
	title: {
		fontSize: 16,
		fontWeight: 'bold',
		marginBottom: 10,
	},
	themeContainer: {
		flexDirection: 'row',
		marginBottom: 20,
	},
	themeButton: {
		flex: 1,
		padding: 10,
		alignItems: 'center',
		borderRadius: 5,
		marginRight: 10,
	},
	themeButtonText: {
		fontSize: 14,
		fontWeight: 'bold',
	},
	colorsContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		marginBottom: 20,
	},
	colorOption: {
		width: 40,
		height: 40,
		borderRadius: 20,
		marginRight: 10,
		marginBottom: 10,
	},
	selectedColor: {
		borderWidth: 3,
	},
})

export default ThemeSettings
