import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse } from '../types/api.ts';
import { api } from './api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active=true;
    if(!token){setUser(null);setLoading(false);return;}
    setLoading(true);
    api.get<{user:User}>('/auth/me').then(data=>{if(active){setUser(data.user);localStorage.setItem('civicclean_user',JSON.stringify(data.user));}}).catch(()=>{if(active){api.setToken(null);setToken(null);setUser(null);localStorage.removeItem('civicclean_user');}}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  }, [token]);

  const handleAuthSuccess = (data: AuthResponse) => {
    api.setToken(data.token);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('civicclean_user', JSON.stringify(data.user));
    return data.user;
  };

  const login = async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/login', { email, password });
    return handleAuthSuccess(data);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/register', { name, email, password });
    return handleAuthSuccess(data);
  };

  const logout = () => {
    api.setToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem('civicclean_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
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
