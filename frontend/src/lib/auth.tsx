import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { User, AuthResponse } from '../types/api.ts';
import { api } from './api.ts';
import { auth, validateFirebaseConfig } from './firebase.ts';

export function formatFirebaseAuthError(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const code = error.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please verify your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/Password provider is disabled in Firebase Console. Please enable it in project civiclean.';
    default:
      return error.message || 'Authentication failed. Please verify your credentials.';
  }
}

export const OPERATOR_EMAIL = (
  import.meta.env.VITE_OPERATOR_EMAIL || 'civicclean.operator@gmail.com'
).toLowerCase().trim();

export function resolveUserRole(email?: string | null): 'OPERATOR' | 'CITIZEN' {
  if (!email) return 'CITIZEN';
  return email.toLowerCase().trim() === OPERATOR_EMAIL ? 'OPERATOR' : 'CITIZEN';
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isFirebaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [loading, setLoading] = useState<boolean>(true);

  const { valid: isFirebaseConfigured } = validateFirebaseConfig();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Subscribe to Firebase Authentication state changes (source of truth)
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && fbUser.email) {
        try {
          // Stable Firebase UID mapping to application user record
          const data = await api.post<AuthResponse>('/auth/firebase-sync', {
            firebaseUid: fbUser.uid,
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email.split('@')[0],
          });

          // Determine role strictly by exact email comparison with configured OPERATOR_EMAIL
          const resolvedRole = resolveUserRole(fbUser.email);
          const finalUser: User = {
            ...data.user,
            role: resolvedRole,
          };

          api.setToken(data.token);
          setToken(data.token);
          setUser(finalUser);
        } catch (err) {
          console.error('[CivicClean] Session synchronization failed:', err);
          setUser(null);
          setToken(null);
          api.setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
        api.setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    if (!auth) {
      const err = new Error(
        'Firebase configuration is missing in .env.local. Please configure your Firebase web credentials for project civiclean.'
      );
      throw err;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = userCredential.user;
      setFirebaseUser(fbUser);

      // Synchronize with backend database by stable Firebase UID
      const data = await api.post<AuthResponse>('/auth/firebase-sync', {
        firebaseUid: fbUser.uid,
        email: fbUser.email || email.trim(),
        name: fbUser.displayName || email.trim().split('@')[0],
      });

      // Exact email comparison determines role
      const resolvedRole = resolveUserRole(fbUser.email || email);
      const finalUser: User = {
        ...data.user,
        role: resolvedRole,
      };

      api.setToken(data.token);
      setToken(data.token);
      setUser(finalUser);
      return finalUser;
    } catch (err: any) {
      const friendlyMsg = formatFirebaseAuthError(err);
      const customErr = new Error(friendlyMsg);
      (customErr as any).code = err.code;
      throw customErr;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    if (!auth) {
      const err = new Error(
        'Firebase configuration is missing in .env.local. Please configure your Firebase web credentials for project civiclean.'
      );
      throw err;
    }

    try {
      // 1. Create Firebase Authentication Account
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = userCredential.user;

      // 2. Set Firebase User Display Name
      if (name.trim()) {
        try {
          await updateProfile(fbUser, { displayName: name.trim() });
        } catch (profileErr) {
          console.warn('[CivicClean] Could not update Firebase display name:', profileErr);
        }
      }

      setFirebaseUser(fbUser);

      // 3. Synchronize with backend database (always CITIZEN for public registration)
      const data = await api.post<AuthResponse>('/auth/firebase-sync', {
        firebaseUid: fbUser.uid,
        email: fbUser.email || email.trim(),
        name: name.trim() || 'Citizen',
      });

      const resolvedRole = resolveUserRole(fbUser.email || email);
      const finalUser: User = {
        ...data.user,
        role: resolvedRole,
      };

      api.setToken(data.token);
      setToken(data.token);
      setUser(finalUser);
      return finalUser;
    } catch (err: any) {
      const friendlyMsg = formatFirebaseAuthError(err);
      const customErr = new Error(friendlyMsg);
      (customErr as any).code = err.code;
      throw customErr;
    }
  };

  const logout = async (): Promise<void> => {
    if (auth) {
      await signOut(auth);
    }
    api.setToken(null);
    setToken(null);
    setUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        token,
        loading,
        login,
        register,
        logout,
        isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
