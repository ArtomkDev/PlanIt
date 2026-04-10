import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';

export function generateId() {
  try {
    return uuidv4();
  } catch (error) {
    console.warn("Failed to generate UUID, using fallback:", error);
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}