import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Cart from './pages/Cart'
import Orders from './pages/Orders'
import Notifications from './pages/Notifications'
import WishList from './pages/WishList'
import Chat from './pages/Chat'
import EditProfile from './pages/EditProfile'
import ProductDetail from './pages/ProductDetail'

import SellerDashboard from './pages/SellerDashboard'
import SellerProducts from './pages/SellerProducts'
import SellerAnalytics from './pages/SellerAnalytics'
import SellerChats from './pages/SellerChats'
import SellerProfile from './pages/SellerProfile'

import AdminDashboard from './pages/AdminDashboard'
import NotFound from './pages/NotFound'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/seller-profile/:sellerId" element={<SellerProfile />} />

            {/* Customer */}
            <Route path="/cart" element={<ProtectedRoute role="user"><Cart /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute role="user"><Orders /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute role="user"><Notifications /></ProtectedRoute>} />
            <Route path="/wishlist" element={<ProtectedRoute role="user"><WishList /></ProtectedRoute>} />
            <Route path="/chat/:sellerId" element={<ProtectedRoute role="user"><Chat /></ProtectedRoute>} />

            {/* Shared */}
            <Route path="/profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />

            {/* Seller */}
            <Route path="/seller" element={<ProtectedRoute role="seller"><SellerDashboard /></ProtectedRoute>} />
            <Route path="/seller/products" element={<ProtectedRoute role="seller"><SellerProducts /></ProtectedRoute>} />
            <Route path="/seller/analytics" element={<ProtectedRoute role="seller"><SellerAnalytics /></ProtectedRoute>} />
            <Route path="/seller/chats" element={<ProtectedRoute role="seller"><SellerChats /></ProtectedRoute>} />

            {/* Admin + Superadmin — same dashboard, role-aware inside */}
            <Route path="/admin" element={<ProtectedRoute roles={['admin','superadmin']}><AdminDashboard /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
