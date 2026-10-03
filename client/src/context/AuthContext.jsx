import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  fetchMe,
  loginUser,
  logoutUser,
  registerUser,
  setToken as persistToken,
  getToken,
} from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: if a token survived a page reload, verify it's still
  // valid via /api/auth/me before trusting it and reconnecting the socket.
  useEffect(() => {
    const existingToken = getToken();
    if (!existingToken) {
      setLoading(false);
      return;
    }

    fetchMe()
      .then((me) => {
        setUser(me);
        connectSocket(existingToken);
      })
      .catch(() => {
        persistToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAuthSuccess = useCallback(({ token, user: authedUser }) => {
    persistToken(token);
    setUser(authedUser);
    connectSocket(token);
  }, []);

  const register = useCallback(
    async (fields) => {
      const data = await registerUser(fields);
      handleAuthSuccess(data);
    },
    [handleAuthSuccess]
  );

  const login = useCallback(
    async (fields) => {
      const data = await loginUser(fields);
      handleAuthSuccess(data);
    },
    [handleAuthSuccess]
  );

  const logout = useCallback(async () => {
    await logoutUser();
    persistToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
