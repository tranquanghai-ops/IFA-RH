import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBaKAtmgK2BlaTLvUKS4_esgmZduITNCYA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ifa-rh.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ifa-rh",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ifa-rh.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "117163532878",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:117163532878:web:6eb1afd59dc6cc47cc591f",
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
