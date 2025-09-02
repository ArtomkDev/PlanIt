import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";
import { getDeviceId } from "./deviceService";

export async function listenDeviceStatus(userId) {
  if (!userId) return () => {};

  const deviceId = await getDeviceId(userId); // ← await !!!
  const ref = doc(db, "users", userId, "devices", deviceId);

  const unsubscribe = onSnapshot(ref, async (snap) => {
    if (snap.exists() && snap.data().isActive === false) {
      console.warn("⛔ Цей пристрій від’єднано → вихід з акаунта");
      await AsyncStorage.clear();
      await signOut(auth);
    }
  });

  return unsubscribe;
}

