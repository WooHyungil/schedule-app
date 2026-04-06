import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithCustomToken,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDvq3XNvneLJchFBBQTpLZLFvQJe3vU3vc',
  authDomain: 'schedule-app-46575.firebaseapp.com',
  projectId: 'schedule-app-46575',
  storageBucket: 'schedule-app-46575.appspot.com',
  messagingSenderId: '1070524189819',
  appId: '1:1070524189819:web:9d4f2f3b8a8f7c6d5e4',
  measurementId: 'G-3XKQWLVPZM',
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Auth 초기화
export const auth = getAuth(app);

// Google 제공자
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Firestore 초기화
export const db = getFirestore(app);

// Functions 초기화
export const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-northeast3';
export const functions = getFunctions(app, functionsRegion);

// Firestore 오프라인 지속성 활성화
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported in this environment');
  }
});

// Storage 초기화
export const storage = getStorage(app);

export { signInWithCustomToken };

// 개발 환경에서 에뮬레이터 사용 선택 사항
const isDevelopment = import.meta.env.DEV;
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (isDevelopment && useEmulator) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('Firebase emulators connected');
  } catch (error) {
    console.warn('Emulator connection error:', error);
  }
}

export default app;
