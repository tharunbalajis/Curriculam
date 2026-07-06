import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('currisync_token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('currisync_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const freshUser = await api.auth.me(token);
        setUser(freshUser);
        localStorage.setItem('currisync_user', JSON.stringify(freshUser));
      } catch (err) {
        logout();
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email, password) {
    const { token: newToken, user: newUser } = await api.auth.login(email, password);
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('currisync_token', newToken);
    localStorage.setItem('currisync_user', JSON.stringify(newUser));
    return newUser;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('currisync_token');
    localStorage.removeItem('currisync_user');
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
