import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: {
    email: string;
    password: string;
    full_name: string;
    nip?: string;
    jabatan?: string;
  }) => Promise<UserProfile>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      full_name: string;
      nip?: string;
      jabatan?: string;
    }) => {
      const res = await apiRequest<{ token: string | null; user: UserProfile }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      if (res.token) {
        setStoredToken(res.token);
        setUser(res.user);
      }
      return res.user;
    },
    []
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return ctx;
}
