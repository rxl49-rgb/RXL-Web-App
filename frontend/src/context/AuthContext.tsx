import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  address?: string;
  customerCode?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (formData: FormData) => Promise<{ message?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('rxl_user');
    const token = localStorage.getItem('rxl_token');
    if (stored && token) {
      setUser(JSON.parse(stored));
      api.get('/auth/me').then(r => {
        setUser(r.data);
        localStorage.setItem('rxl_user', JSON.stringify(r.data));
      }).catch(() => {
        localStorage.removeItem('rxl_token');
        localStorage.removeItem('rxl_user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('rxl_token', data.token);
    localStorage.setItem('rxl_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (formData: FormData) => {
    // New accounts are PENDING until an admin activates them, so no token is issued here
    // and we don't log the user in — the caller shows a confirmation and sends them to /login.
    const { data } = await api.post('/auth/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return { message: data.message as string | undefined };
  };

  const logout = () => {
    localStorage.removeItem('rxl_token');
    localStorage.removeItem('rxl_user');
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    const res = await api.put('/auth/me', data);
    setUser(res.data);
    localStorage.setItem('rxl_user', JSON.stringify(res.data));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
