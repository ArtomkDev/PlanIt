import { initializeApp } from "firebase/app";
import { 
    initializeFirestore, 
    memoryLocalCache,
    doc, 
    getDoc, 
    onSnapshot, 
    setDoc, 
    updateDoc 
} from "firebase/firestore";
import {
    getAuth,
    initializeAuth,
    getReactNativePersistence,
    browserLocalPersistence
} from "firebase/auth";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const normalizeStorageBucket = (value) => {
    if (!value) return "";
    return String(value)
        .trim()
        .replace(/^gs:\/\//, "")
        .replace(/^https?:\/\//, "")
        .split("/")[0];
};

const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucketName = normalizeStorageBucket(
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
    || (projectId ? `${projectId}.firebasestorage.app` : "")
);

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: storageBucketName,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const storage = storageBucketName
    ? getStorage(app, `gs://${storageBucketName}`)
    : getStorage(app);

const db = initializeFirestore(app, {
  // The Firebase Web SDK persistentLocalCache relies on browser IndexedDB.
  // In Expo/React Native native runtimes that storage layer is not stable,
  // so schedule startup/offline state is persisted through AsyncStorage instead.
  localCache: memoryLocalCache() 
});

let auth;

if (typeof window !== "undefined" && typeof document !== "undefined") {
    auth = getAuth(app);
    auth.setPersistence(browserLocalPersistence);
} else {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
}

export { app, auth, db, storage, storageBucketName, doc, getDoc, onSnapshot, setDoc, updateDoc };
