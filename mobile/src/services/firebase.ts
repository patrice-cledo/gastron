import { Platform } from 'react-native';
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

// Ensure React Native Firebase default app exists (required for @react-native-firebase/auth).
// Native plist configures [DEFAULT] at launch; we must see it in getApps() before any initializeApp
// (calling initializeApp when plist already did causes "already configured" and leaves JS registry empty).
export const rnFirebaseReady: Promise<void> = (() => {
  try {
    const rnFirebaseApp = require('@react-native-firebase/app').default;
    // Native SDK needs platform-specific app id (plist has iOS, google-services.json has Android).
    const rnConfig = {
      ...firebaseConfig,
      databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`,
      ...(Platform.OS === 'ios' && {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_IOS_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDv3sWLsoGdx1Dab5vqTsH8vCL1vRM6pBw',
        appId: process.env.EXPO_PUBLIC_FIREBASE_IOS_APP_ID || '1:721390142342:ios:036e954a3d550ba6942207',
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_IOS_MESSAGING_SENDER_ID || '721390142342',
      }),
      ...(Platform.OS === 'android' && {
        appId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID || firebaseConfig.appId,
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
      }),
    };
    return (async () => {
      const rnfAppMod = require('@react-native-firebase/app');
      // Wait for native plist to register the default app so getApp() works (avoids calling initializeApp).
      await new Promise((r) => setTimeout(r, 400));
      for (let i = 0; i < 30; i++) {
        try {
          rnfAppMod.getApp();
          return; // getApp() succeeded; [DEFAULT] is in the registry.
        } catch {
          // No app yet; keep waiting or will create below.
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      // No plist app found; create from JS with platform-specific config.
      await rnFirebaseApp.initializeApp(rnConfig);
      rnfAppMod.getApp(); // ensure it's in the registry
    })().catch(async (e: unknown) => {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '';
      if (msg.includes('already exists') || msg.includes('already been configured')) {
        // Native plist already configured the app; give JS a moment to see it, then verify.
        const rnfAppMod = require('@react-native-firebase/app');
        for (let j = 0; j < 10; j++) {
          await new Promise((r) => setTimeout(r, 100));
          try {
            rnfAppMod.getApp();
            return;
          } catch {
            /* retry */
          }
        }
      }
      throw e;
    });
  } catch {
    return Promise.resolve();
  }
})();

// Initialize Firebase (JS SDK)
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
