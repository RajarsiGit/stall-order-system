import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './lib/CartContext';
import { OwnerAuthProvider } from './lib/OwnerAuthContext';
import { AdminAuthProvider } from './lib/AdminAuthContext';
import { CustomerAuthProvider } from './lib/CustomerAuthContext';
import RequireOwnerAuth from './components/RequireOwnerAuth';
import RequireAdminAuth from './components/RequireAdminAuth';
import RequireCustomerAuth from './components/RequireCustomerAuth';
import RequireManager from './components/RequireManager';
import RequireSuperAdmin from './components/RequireSuperAdmin';

import Landing from './pages/Landing';
import StallList from './pages/StallList';
import StallMenu from './pages/StallMenu';
import Checkout from './pages/Checkout';
import OrderTrack from './pages/OrderTrack';
import CustomerLogin from './pages/CustomerLogin';
import CustomerRegister from './pages/CustomerRegister';
import CustomerOrders from './pages/CustomerOrders';
import OwnerLogin from './pages/OwnerLogin';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerMenu from './pages/OwnerMenu';
import StaffManagement from './pages/StaffManagement';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminManagement from './pages/AdminManagement';

export default function App() {
  return (
    <AdminAuthProvider>
      <OwnerAuthProvider>
        <CustomerAuthProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route
                  path="/stalls"
                  element={
                    <RequireCustomerAuth>
                      <StallList />
                    </RequireCustomerAuth>
                  }
                />
                <Route path="/customer/login" element={<CustomerLogin />} />
                <Route path="/customer/register" element={<CustomerRegister />} />
                <Route
                  path="/customer/orders"
                  element={
                    <RequireCustomerAuth>
                      <CustomerOrders />
                    </RequireCustomerAuth>
                  }
                />

                <Route
                  path="/stall/:stallId"
                  element={
                    <RequireCustomerAuth>
                      <StallMenu />
                    </RequireCustomerAuth>
                  }
                />
                <Route
                  path="/stall/:stallId/checkout"
                  element={
                    <RequireCustomerAuth>
                      <Checkout />
                    </RequireCustomerAuth>
                  }
                />
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
                    <RequireManager>
                      <OwnerMenu />
                    </RequireManager>
                  }
                />
                <Route
                  path="/owner/staff"
                  element={
                    <RequireManager>
                      <StaffManagement />
                    </RequireManager>
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
                <Route
                  path="/admin/admins"
                  element={
                    <RequireSuperAdmin>
                      <AdminManagement />
                    </RequireSuperAdmin>
                  }
                />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </CustomerAuthProvider>
      </OwnerAuthProvider>
    </AdminAuthProvider>
  );
}
