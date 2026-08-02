const BASE = '/api';

function getToken() {
  return localStorage.getItem('owner_token');
}

function getAdminToken() {
  return localStorage.getItem('admin_token');
}

function getCustomerToken() {
  return localStorage.getItem('customer_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = options.token !== undefined ? options.token : getToken();
  if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Public
  getStalls: () => request('/stalls'),
  getStallMenu: (stallId) => request(`/stalls/${stallId}/menu`),
  trackOrder: (orderNumber) => request(`/orders/track/${orderNumber}`),

  // Customer
  customerRegister: (payload) =>
    request('/customer/register', { method: 'POST', body: JSON.stringify(payload), skipAuth: true }),
  customerLogin: (email, password) =>
    request('/customer/login', { method: 'POST', body: JSON.stringify({ email, password }), skipAuth: true }),
  customerMe: () => request('/customer/me', { token: getCustomerToken() }),
  placeOrder: (payload) =>
    request('/orders', { method: 'POST', body: JSON.stringify(payload), token: getCustomerToken() }),
  getCustomerOrders: () => request('/customer/orders', { token: getCustomerToken() }),
  getCustomerNotifications: () => request('/customer/notifications', { token: getCustomerToken() }),
  markCustomerNotificationsRead: () =>
    request('/customer/notifications/read-all', { method: 'POST', token: getCustomerToken() }),

  // Auth
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }), skipAuth: true }),
  me: () => request('/auth/me'),

  // Owner
  getOwnerOrders: (status) => request(`/owner/orders${status ? `?status=${status}` : ''}`),
  getOwnerOrderHistory: () => request('/owner/orders/history'),
  updateOrderStatus: (orderId, status) =>
    request(`/owner/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updatePaymentStatus: (orderId, payment_status) =>
    request(`/owner/orders/${orderId}/payment`, { method: 'PATCH', body: JSON.stringify({ payment_status }) }),
  getOwnerMenu: () => request('/owner/menu'),
  createMenuItem: (payload) => request('/owner/menu', { method: 'POST', body: JSON.stringify(payload) }),
  updateMenuItem: (id, payload) => request(`/owner/menu/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteMenuItem: (id) => request(`/owner/menu/${id}`, { method: 'DELETE' }),
  setStallOpen: (is_open) => request('/owner/stall', { method: 'PATCH', body: JSON.stringify({ is_open }) }),
  getOwnerNotifications: () => request('/owner/notifications'),
  markOwnerNotificationsRead: () => request('/owner/notifications/read-all', { method: 'POST' }),
  getOwnerStaff: () => request('/owner/staff'),
  createStaff: (payload) => request('/owner/staff', { method: 'POST', body: JSON.stringify(payload) }),
  updateStaff: (staffId, payload) =>
    request(`/owner/staff/${staffId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteStaff: (staffId) => request(`/owner/staff/${staffId}`, { method: 'DELETE' }),

  // Admin
  adminLogin: (username, password) =>
    request('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }), skipAuth: true }),
  adminMe: () => request('/admin/me', { token: getAdminToken() }),
  getAdminStalls: () => request('/admin/stalls', { token: getAdminToken() }),
  createStall: (payload) =>
    request('/admin/stalls', { method: 'POST', body: JSON.stringify(payload), token: getAdminToken() }),
  getAdminAdmins: () => request('/admin/admins', { token: getAdminToken() }),
  createAdminAccount: (payload) =>
    request('/admin/admins', { method: 'POST', body: JSON.stringify(payload), token: getAdminToken() }),
  updateAdminAccount: (adminId, payload) =>
    request(`/admin/admins/${adminId}`, { method: 'PATCH', body: JSON.stringify(payload), token: getAdminToken() }),
  deleteAdminAccount: (adminId) =>
    request(`/admin/admins/${adminId}`, { method: 'DELETE', token: getAdminToken() }),
};

export function setToken(token) {
  localStorage.setItem('owner_token', token);
}
export function clearToken() {
  localStorage.removeItem('owner_token');
}
export function setAdminToken(token) {
  localStorage.setItem('admin_token', token);
}
export function clearAdminToken() {
  localStorage.removeItem('admin_token');
}
export function setCustomerToken(token) {
  localStorage.setItem('customer_token', token);
}
export function clearCustomerToken() {
  localStorage.removeItem('customer_token');
}
export { getToken, getAdminToken, getCustomerToken };
