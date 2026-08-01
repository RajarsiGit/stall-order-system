import { createContext, useContext, useEffect, useState } from 'react';
import { api, setAdminToken, clearAdminToken, getAdminToken } from './api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) {
      setReady(true);
      return;
    }
    api
      .adminMe()
      .then((data) => setAdmin(data.admin))
      .catch(() => clearAdminToken())
      .finally(() => setReady(true));
  }, []);

  async function login(username, password) {
    const data = await api.adminLogin(username, password);
    setAdminToken(data.token);
    setAdmin(data.admin);
    return data;
  }

  function logout() {
    clearAdminToken();
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider value={{ admin, ready, login, logout }}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
