import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './lib/CartContext';
import { OwnerAuthProvider } from './lib/OwnerAuthContext';
import { AdminAuthProvider } from './lib/AdminAuthContext';
import RequireOwnerAuth from './components/RequireOwnerAuth';
import RequireAdminAuth from './components/RequireAdminAuth';

import StallList from './pages/StallList';
import StallMenu from './pages/StallMenu';
import Checkout from './pages/Checkout';
import OrderTrack from './pages/OrderTrack';
import OwnerLogin from './pages/OwnerLogin';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerMenu from './pages/OwnerMenu';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <AdminAuthProvider>
      <OwnerAuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<StallList />} />
              <Route path="/stall/:stallId" element={<StallMenu />} />
              <Route path="/stall/:stallId/checkout" element={<Checkout />} />
              <Route path="/track" element={<OrderTrack />} />
              <Route path="/order/:orderNumber" element={<OrderTrack />} />

              <Route path="/owner/login" element={<OwnerLogin />} />
              <Route
                path="/owner/dashboard"
                element={
                  <RequireOwnerAuth>
                    <OwnerDashboard />
                  </RequireOwnerAuth>
                }
              />
              <Route
                path="/owner/menu"
                element={
                  <RequireOwnerAuth>
                    <OwnerMenu />
                  </RequireOwnerAuth>
                }
              />

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin/dashboard"
                element={
                  <RequireAdminAuth>
                    <AdminDashboard />
                  </RequireAdminAuth>
                }
              />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </OwnerAuthProvider>
    </AdminAuthProvider>
  );
}
