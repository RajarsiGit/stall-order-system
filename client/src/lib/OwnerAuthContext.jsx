import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, clearToken, getToken } from './api';

const OwnerAuthContext = createContext(null);

export function OwnerAuthProvider({ children }) {
  const [stall, setStall] = useState(null);
  const [owner, setOwner] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then((data) => {
        setStall(data.stall);
        setOwner(data.owner);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setReady(true));
  }, []);

  async function login(username, password) {
    const data = await api.login(username, password);
    setToken(data.token);
    setStall(data.stall);
    setOwner(data.owner);
    return data;
  }

  function logout() {
    clearToken();
    setStall(null);
    setOwner(null);
  }

  return (
    <OwnerAuthContext.Provider value={{ stall, owner, ready, login, logout, setStall }}>
      {children}
    </OwnerAuthContext.Provider>
  );
}

export function useOwnerAuth() {
  const ctx = useContext(OwnerAuthContext);
  if (!ctx) throw new Error('useOwnerAuth must be used within OwnerAuthProvider');
  return ctx;
}
