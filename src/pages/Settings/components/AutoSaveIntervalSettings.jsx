import React, { useState } from 'react'
import {
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native'

const AutoSaveIntervalSettings = ({
	autoSaveInterval,
	onIntervalChange,
	themeColors,
	accent,
}) => {
	const [tempInterval, setTempInterval] = useState(autoSaveInterval)

	const confirmIntervalChange = () => {
		const correctedInterval = tempInterval < 30 ? 30 : tempInterval
		setTempInterval(correctedInterval) // Оновлюємо локальний стан
		onIntervalChange(correctedInterval) // Передаємо зміни в батьківський компонент
	}

	const isValueChanged = tempInterval !== autoSaveInterval

	return (
		<View style={styles.inputContainer}>
			<Text style={[styles.label, { color: themeColors.textColor }]}>
				Інтервал автозбереження (секунди):
			</Text>
			<TextInput
				style={[
					styles.input,
					{
						borderColor: themeColors.textColor2,
						color: themeColors.textColor,
					},
				]}
				keyboardType='number-pad'
				value={String(tempInterval)}
				onChangeText={value => setTempInterval(Number(value))}
			/>
			<TouchableOpacity
				style={[
					styles.confirmButton,
					{
						backgroundColor: isValueChanged
							? accent
							: themeColors.backgroundColor2,
					},
				]}
				onPress={confirmIntervalChange}
				disabled={!isValueChanged}
			>
				<Text style={{ color: themeColors.textColor }}>
					Підтвердити
				</Text>
			</TouchableOpacity>
		</View>
	)
}

const styles = StyleSheet.create({
	inputContainer: {
		marginBottom: 20,
		alignItems: 'center',
	},
	input: {
		borderWidth: 1,
		borderColor: '#ccc',
		padding: 10,
		borderRadius: 5,
		width: '60%',
		textAlign: 'center',
	},
	confirmButton: {
		backgroundColor: '#007bff',
		paddingVertical: 10,
		paddingHorizontal: 15,
		borderRadius: 5,
		marginTop: 10,
	},
	confirmButtonText: {
		color: '#fff',
		fontWeight: 'bold',
	},
	disabledButton: {
		backgroundColor: '#ccc',
	},
})

export default AutoSaveIntervalSettings
