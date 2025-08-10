// firebase.js
import { getAnalytics } from 'firebase/analytics' // Для аналітики
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth' // Для автентифікації
import {
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    setDoc,
    updateDoc,
} from 'firebase/firestore'

// Конфігурація Firebase з нового проекту
const firebaseConfig = {
    apiKey: 'AIzaSyD7PcSEZkYGtgTw2fWE1Q0dtD0svw-nua8',
    authDomain: 'errn-cacb3.firebaseapp.com',
    projectId: 'errn-cacb3',
    storageBucket: 'errn-cacb3.firebasestorage.app',
    messagingSenderId: '66089248812',
    appId: '1:66089248812:web:05d553816b8f701b038989',
    measurementId: 'G-04JWLXNTSE',
}

// Ініціалізація Firebase
const app = initializeApp(firebaseConfig)
const analytics = getAnalytics(app) // Аналітика
const db = getFirestore(app) // Firestore
const auth = getAuth(app) // Автентифікація

// Експорт модулів
export { analytics, app, auth, db, doc, getDoc, onSnapshot, setDoc, updateDoc }