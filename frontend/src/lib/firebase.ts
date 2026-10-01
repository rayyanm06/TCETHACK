import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];

export function validateFirebaseConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const key of requiredKeys) {
    if (!firebaseConfig[key]) {
      missing.push(`VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
    }
  }
  return {
    valid: missing.length === 0,
    missing,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

const { valid, missing } = validateFirebaseConfig();

if (!valid) {
  console.warn(
    `[CivicClean Firebase] Missing required environment variables in .env.local: ${missing.join(', ')}. Please configure your Firebase web credentials for project 'civiclean'.`
  );
} else {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
  } catch (error) {
    console.error('[CivicClean Firebase] Initialization error:', error);
  }
}

export { app, auth };
