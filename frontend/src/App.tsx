import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { loadAndApplyAppearance } from './lib/appearance';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Shipment from './pages/Shipment';
import ShipmentDetail from './pages/ShipmentDetail';
import Track from './pages/Track';
import Store from './pages/Store';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Quote from './pages/Quote';
import TruckingCheckout from './pages/TruckingCheckout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminFreight from './pages/admin/AdminFreight';
import AdminStore from './pages/admin/AdminStore';
import AdminCouriers from './pages/admin/AdminCouriers';
import AdminLoadingGuide from './pages/admin/AdminLoadingGuide';
import AdminNewsletter from './pages/admin/AdminNewsletter';
import AdminTally from './pages/admin/AdminTally';
import AdminBatches from './pages/admin/AdminBatches';
import AdminBizJournal from './pages/admin/AdminBizJournal';
import AdminManifest from './pages/admin/AdminManifest';
import AdminWarehouseScans from './pages/admin/AdminWarehouseScans';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAppearance from './pages/admin/AdminAppearance';
import AdminBulletins from './pages/admin/AdminBulletins';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminAdvertisement from './pages/admin/AdminAdvertisement';
import AdminPricingPresets from './pages/admin/AdminPricingPresets';
import AdminShippingPresets from './pages/admin/AdminShippingPresets';
import AdminMobileInfo from './pages/admin/AdminMobileInfo';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AdminRoute from './components/layout/AdminRoute';
import AdminLayout from './components/layout/AdminLayout';

export default function App() {
  useEffect(() => {
    loadAndApplyAppearance();
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="shipment" element={<Shipment />} />
              <Route path="shipment/:id" element={<ShipmentDetail />} />
              <Route path="track" element={<Track />} />
              <Route path="store" element={<Store />} />
              <Route path="store/:id" element={<ProductDetail />} />
              <Route path="cart" element={<Cart />} />
              <Route path="quote" element={<Quote />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route element={<ProtectedRoute />}>
                <Route path="checkout" element={<Checkout />} />
                <Route path="quote/checkout" element={<TruckingCheckout />} />
                <Route path="order/:id" element={<OrderConfirmation />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="dashboard/*" element={<Dashboard />} />
              </Route>
            </Route>

            {/* Admin area — separate login and shell, not the customer-facing Layout */}
            <Route path="admin/login" element={<AdminLogin />} />
            <Route path="admin" element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="batches" element={<AdminBatches />} />
                <Route path="freight" element={<AdminFreight />} />
                <Route path="store" element={<AdminStore />} />
                <Route path="couriers" element={<AdminCouriers />} />
                <Route path="loading-guide" element={<AdminLoadingGuide />} />
                <Route path="newsletter" element={<AdminNewsletter />} />
                <Route path="tally" element={<AdminTally />} />
                <Route path="biz-journal" element={<AdminBizJournal />} />
                <Route path="manifest" element={<AdminManifest />} />
                <Route path="warehouse-scans" element={<AdminWarehouseScans />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="appearance" element={<AdminAppearance />} />
                <Route path="bulletins" element={<AdminBulletins />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="advertisement" element={<AdminAdvertisement />} />
                <Route path="presets/pricing" element={<AdminPricingPresets />} />
                <Route path="presets/shipping" element={<AdminShippingPresets />} />
                <Route path="mobile-info" element={<AdminMobileInfo />} />
              </Route>
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
