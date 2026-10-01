import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse } from '../types/api.ts';
import { api } from './api.ts';

export const OPERATOR_EMAIL = (
  import.meta.env.VITE_OPERATOR_EMAIL || 'civicclean.operator@gmail.com'
).toLowerCase().trim();

export function resolveUserRole(email?: string | null): 'OPERATOR' | 'CITIZEN' {
  if (!email) return 'CITIZEN';
  return email.toLowerCase().trim() === OPERATOR_EMAIL ? 'OPERATOR' : 'CITIZEN';
}

export function formatFirebaseAuthError(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  return error.message || 'Authentication failed. Please verify your credentials.';
}

interface AuthContextType {
  user: User | null;
  firebaseUser: null;
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
  const [token, setToken] = useState<string | null>(api.getToken());
  const [loading, setLoading] = useState<boolean>(true);

  // On mount, try to restore session from stored token
  useEffect(() => {
    async function restoreSession() {
      const storedToken = api.getToken();
      if (storedToken) {
        try {
          // Validate the token by calling a lightweight endpoint
          const data = await api.get<{ user: User }>('/auth/me');
          setUser(data.user);
          setToken(storedToken);
        } catch {
          // Token is invalid/expired, clear it
          api.setToken(null);
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    restoreSession();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const data = await api.post<AuthResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      api.setToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      throw new Error(msg);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    try {
      const data = await api.post<AuthResponse>('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      api.setToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      const msg = err.message || 'Registration failed. Please try again.';
      throw new Error(msg);
    }
  };

  const logout = async (): Promise<void> => {
    api.setToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser: null,
        token,
        loading,
        login,
        register,
        logout,
        isFirebaseConfigured: true, // Always true so UI doesn't show Firebase warnings
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
