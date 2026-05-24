import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance;

if (!global.__FIREBASE_AUTH__) {
  try {
    if (Platform.OS === 'web' || typeof getReactNativePersistence !== 'function') {
      authInstance = getAuth(app);
    } else {
      // Explicitly wrap AsyncStorage to ensure Firebase recognizes it
      const asyncStorageWrapper = {
        getItem: (key) => AsyncStorage.getItem(key),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        removeItem: (key) => AsyncStorage.removeItem(key),
      };

      authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(asyncStorageWrapper),
      });
    }
    global.__FIREBASE_AUTH__ = authInstance;
  } catch (e) {
    console.error("FIREBASE AUTH INIT ERROR:", e);
    // If it fails (e.g. already initialized), try to get the existing instance
    authInstance = getAuth(app);
    global.__FIREBASE_AUTH__ = authInstance;
  }
} else {
  authInstance = global.__FIREBASE_AUTH__;
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);

