const BASE = '/api';

function getToken() {
  return localStorage.getItem('owner_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
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
  placeOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  trackOrder: (orderNumber) => request(`/orders/track/${orderNumber}`),

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
};

export function setToken(token) {
  localStorage.setItem('owner_token', token);
}
export function clearToken() {
  localStorage.removeItem('owner_token');
}
export { getToken };
