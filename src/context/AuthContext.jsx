import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const res = await api.post('/auth/refresh');
      if (res.data?.accessToken) {
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        const me = await api.get('/auth/me');
        setProfile(me.data?.profile || null);
      }
    } catch {
      setAccessToken(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    const me = await api.get('/auth/me');
    setProfile(me.data?.profile || null);
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      setProfile(null);
    }
  };

  const refreshMe = async () => {
    const me = await api.get('/auth/me');
    setUser(me.data.user);
    setProfile(me.data?.profile || null);
  };

  const getDashboardPath = (role = user?.role) => {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return '/admin';
    if (role === 'INSTRUCTOR') return '/instructor';
    return '/student';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        refreshMe,
        getDashboardPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
