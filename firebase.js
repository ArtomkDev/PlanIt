// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import {
    getAuth,
    initializeAuth,
    getReactNativePersistence,
    browserLocalPersistence
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Конфіг Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD7PcSEZkYGtgTw2fWE1Q0dtD0svw-nua8",
    authDomain: "errn-cacb3.firebaseapp.com",
    projectId: "errn-cacb3",
    storageBucket: "errn-cacb3.firebasestorage.app",
    messagingSenderId: "66089248812",
    appId: "1:66089248812:web:05d553816b8f701b038989",
    measurementId: "G-04JWLXNTSE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let auth;

// Якщо працюємо в браузері (Web)
if (typeof window !== "undefined" && typeof document !== "undefined") {
    auth = getAuth(app);
    auth.setPersistence(browserLocalPersistence);
} 
// Якщо React Native (iOS / Android)
else {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
}

export { app, auth, db, doc, getDoc, onSnapshot, setDoc, updateDoc };
