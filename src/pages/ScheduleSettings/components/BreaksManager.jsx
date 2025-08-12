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
import useCurrentTheme from '../../../hooks/useCurrentTheme'; // новий імпорт

export default function BreaksManager({ breaks, setBreaks, themeColors, accent }) {
	const [tempBreaks, setTempBreaks] = useState([...breaks]);
	const [isChanged, setIsChanged] = useState(false);

	const currentTheme = useCurrentTheme(); // отримаємо тему без пропсів

	useEffect(() => {
		setIsChanged(JSON.stringify(tempBreaks) !== JSON.stringify(breaks));
	}, [tempBreaks, breaks]);

	const handleBreakChange = (value, index) => {
		const updatedBreaks = [...tempBreaks];
		updatedBreaks[index] = Number(value);
		setTempBreaks(updatedBreaks);
	};

	const handleAddBreak = () => {
		setTempBreaks([...tempBreaks, 10]);
	};

	const handleRemoveBreak = index => {
		const updatedBreaks = tempBreaks.filter((_, i) => i !== index);
		setTempBreaks(updatedBreaks);
	};

	const handleConfirm = () => {
		if (isChanged) {
			setBreaks(tempBreaks);
		}
	};

	return (
		<View style={styles.container}>
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
							backgroundColor: isChanged ? accent : themeColors.backgroundColor2,
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
	container: {
		flex: 1,
		marginBottom: 0,
	},
	containerBlock:{
		paddingLeft:10,
		paddingRight:10,
	},
	title: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#333',
		marginBottom: 20,
		textAlign: 'center',
	},
	breakContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 15,
		backgroundColor: '#fff',
		padding: 10,
		borderRadius: 10,
		shadowColor: '#000',
		shadowOpacity: 0.1,
		shadowRadius: 4,
		shadowOffset: { width: 0, height: 2 },
		elevation: 2,
		padding: 10,
		
	},
	buttonsContainer: {
	  position: 'absolute',
	  bottom: 0,
	  left: 0,
	  right: 0,
	  marginBottom: 80,
	  marginRight: 20,
	  marginLeft:15,
	  flexDirection: 'row',
	  justifyContent: 'space-around',
	  padding: 10,
	  borderRadius: 15,
	  overflow: 'hidden', // щоб BlurView мав закруглення
	},

	breakLabel: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#555',
		marginRight: 10,
	},
	input: {
		borderRadius: 5,
		padding: 10,
		marginRight: 10,
		width: 60,
		textAlign: 'center',
		backgroundColor: '#f7f7f7',
		fontSize: 16,
		color: '#333',
	},
	removeButton: {
		backgroundColor: '#ff5c5c',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 5,
	},
	removeButtonText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 14,
	},
	addButton: {
		backgroundColor: '#4caf50',
		paddingVertical: 15,
		paddingHorizontal: 20,
		borderRadius: 10,
		alignItems: 'center',
	},
	addButtonText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
	},
	confirmButton: {
		backgroundColor: '#007bff',
		paddingVertical: 15,
		paddingHorizontal: 20,
		borderRadius: 10,
		alignItems: 'center',
	},
	confirmButtonText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
	},
	disabledButton: {
		backgroundColor: '#ccc',
	},
})
