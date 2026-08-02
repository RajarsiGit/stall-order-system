import { createContext, useContext, useEffect, useState } from 'react';
import { api, setCustomerToken, clearCustomerToken, getCustomerToken } from './api';

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getCustomerToken()) {
      setReady(true);
      return;
    }
    api
      .customerMe()
      .then((data) => setCustomer(data.customer))
      .catch(() => clearCustomerToken())
      .finally(() => setReady(true));
  }, []);

  async function login(email, password) {
    const data = await api.customerLogin(email, password);
    setCustomerToken(data.token);
    setCustomer(data.customer);
    return data;
  }

  async function register(payload) {
    const data = await api.customerRegister(payload);
    setCustomerToken(data.token);
    setCustomer(data.customer);
    return data;
  }

  function logout() {
    clearCustomerToken();
    setCustomer(null);
  }

  return (
    <CustomerAuthContext.Provider value={{ customer, ready, login, register, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
