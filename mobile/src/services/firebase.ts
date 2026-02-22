import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  connectAuthEmulator,
  Auth,
} from '@firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';

// Firebase configuration (same fallbacks as rest of app; export for phone-auth WebView)
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'cookthispage.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'cookthispage',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'cookthispage.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('🔥 Firebase initialized with projectId:', firebaseConfig.projectId);
} else {
  app = getApps()[0];
  console.log('🔥 Using existing Firebase app, projectId:', app.options.projectId);
}

// Initialize Auth with React Native persistence so login survives app restarts
let auth: Auth;
if (getApps().length === 0) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  auth = getAuth(app);
}
export { auth };

// Initialize Firestore
export const db: Firestore = getFirestore(app);

// Initialize Functions
// For v2 functions, the default region is us-central1
export const functions: Functions = getFunctions(app);

// Initialize Storage
export const storage: FirebaseStorage = getStorage(app);

// Connect to emulators only when in dev and not explicitly disabled (e.g. for device testing with cloud Firebase)
const USE_EMULATOR =
  (process.env.NODE_ENV !== 'production' || __DEV__) &&
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR !== 'false';

if (USE_EMULATOR) {
  try {
    // Check if emulators are already connected by checking if host contains localhost/127.0.0.1
    // Connect to Auth emulator
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    
    // Connect to Firestore emulator
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    
    // Connect to Functions emulator
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    
    // Connect to Storage emulator
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    
    console.log('✅ Connected to Firebase emulators');
    console.log('📦 Project ID:', app.options.projectId);
    console.log('📦 Storage Bucket:', app.options.storageBucket);
    console.log('🔧 Functions emulator: http://127.0.0.1:5001');
    console.log('🔧 Storage emulator: http://127.0.0.1:9199');
  } catch (error: any) {
    // Emulators already connected, ignore error
    if (error?.message?.includes('already been called')) {
      console.log('Firebase emulators already connected');
    } else {
      console.log('Firebase emulator connection error:', error);
    }
  }
}

export default app;
