import * as Crypto from 'expo-crypto';

export function generateId() {
  try {
    return Crypto.randomUUID();
  } catch (error) {
    console.warn("Failed to generate UUID, using fallback:", error);
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}
