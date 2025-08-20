import React, { useEffect, useState } from 'react';
import {
	FlatList,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { useSchedule } from '../../../context/ScheduleProvider'; // ⚡ беремо розклад з провайдера
import useCurrentTheme from '../../../hooks/useCurrentTheme';
import themes from '../../../config/themes';

export default function BreaksManager() {
	const { schedule, setScheduleDraft } = useSchedule(); // ⚡ отримаємо дані та функцію для змін
	const [tempBreaks, setTempBreaks] = useState([...schedule.breaks]);
	const [isChanged, setIsChanged] = useState(false);

	// ⚡ тема + акцент з розкладу
	const [themeMode, accentName] = schedule.theme;
	const themeColors = themes[themeMode];
	const accent = themes.accentColors[accentName];

	const currentTheme = useCurrentTheme();

	useEffect(() => {
		setIsChanged(JSON.stringify(tempBreaks) !== JSON.stringify(schedule.breaks));
	}, [tempBreaks, schedule.breaks]);

	const handleBreakChange = (value, index) => {
		const updatedBreaks = [...tempBreaks];
		updatedBreaks[index] = Number(value);
		setTempBreaks(updatedBreaks);
	};

	const handleAddBreak = () => {
		setTempBreaks([...tempBreaks, 10]);
	};

	const handleRemoveBreak = (index) => {
		const updatedBreaks = tempBreaks.filter((_, i) => i !== index);
		setTempBreaks(updatedBreaks);
	};

	const handleConfirm = () => {
		if (isChanged) {
			// ⚡ оновлюємо розклад через ScheduleProvider
			setScheduleDraft(prev => ({ ...prev, breaks: tempBreaks }));
		}
	};

	return (
		<View style={[
			styles.container,
			{ backgroundColor: themeColors.backgroundColor },
		]}>
			<Text style={[styles.title, { color: themeColors.textColor }]}>
				Редагувати перерви:
			</Text>

			<FlatList
				data={tempBreaks}
				style={styles.containerBlock}
				renderItem={({ item, index }) => (
					<View
						style={[
							styles.breakContainer,
							{ backgroundColor: themeColors.backgroundColor2 },
						]}
					>
						<Text style={[styles.breakLabel, { color: themeColors.textColor }]}>
							Перерва: {index + 1}
						</Text>
						<TextInput
							style={[
								styles.input,
								{
									color: themeColors.textColor,
									backgroundColor: themeColors.backgroundColor,
								},
							]}
							keyboardType="number-pad"
							value={String(item)}
							onChangeText={(value) => handleBreakChange(value, index)}
						/>
						<TouchableOpacity
							style={styles.removeButton}
							onPress={() => handleRemoveBreak(index)}
						>
							<Text style={{ color: themeColors.textColor }}>Видалити</Text>
						</TouchableOpacity>
					</View>
				)}
				keyExtractor={(item, index) => index.toString()}
			/>

			{/* Панель з блюром */}
			<BlurView
				tint={currentTheme === 'dark' ? 'dark' : 'light'}
				intensity={100}
				style={styles.buttonsContainer}
			>
				<TouchableOpacity
					style={[styles.addButton, { backgroundColor: accent }]}
					onPress={handleAddBreak}
				>
					<Text style={{ color: themeColors.textColor }}>Додати перерву</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.confirmButton,
						{
							backgroundColor: isChanged
								? accent
								: themeColors.backgroundColor2,
						},
					]}
					onPress={handleConfirm}
					disabled={!isChanged}
				>
					<Text
						style={[styles.confirmButtonText, { color: themeColors.textColor }]}
					>
						Підтвердити
					</Text>
				</TouchableOpacity>
			</BlurView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, marginBottom: 0 },
	containerBlock: { paddingLeft: 10, paddingRight: 10 },
	title: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 20,
		textAlign: 'center',
	},
	breakContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 15,
		padding: 10,
		borderRadius: 10,
		elevation: 2,
	},
	buttonsContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		marginBottom: 80,
		marginRight: 20,
		marginLeft: 15,
		flexDirection: 'row',
		justifyContent: 'space-around',
		padding: 10,
		borderRadius: 15,
		overflow: 'hidden',
	},
	breakLabel: { fontSize: 16, fontWeight: 'bold', marginRight: 10 },
	input: {
		borderRadius: 5,
		padding: 10,
		marginRight: 10,
		width: 60,
		textAlign: 'center',
		fontSize: 16,
	},
	removeButton: {
		backgroundColor: '#ff5c5c',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 5,
	},
	removeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
	addButton: {
		paddingVertical: 15,
		paddingHorizontal: 20,
		borderRadius: 10,
		alignItems: 'center',
	},
	addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
	confirmButton: {
		paddingVertical: 15,
		paddingHorizontal: 20,
		borderRadius: 10,
		alignItems: 'center',
	},
	confirmButtonText: { fontWeight: 'bold', fontSize: 16 },
	disabledButton: { backgroundColor: '#ccc' },
});
