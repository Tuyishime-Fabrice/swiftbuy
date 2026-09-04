import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth-context'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import SetupRequired from './components/SetupRequired'
import { Spinner } from './components/UI'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'

const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const StorePage = lazy(() => import('./pages/StorePage'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Orders = lazy(() => import('./pages/Orders'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const Messages = lazy(() => import('./pages/Messages'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Profile = lazy(() => import('./pages/Profile'))
const SellerApply = lazy(() => import('./pages/SellerApply'))

const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'))
const SellerProducts = lazy(() => import('./pages/seller/SellerProducts'))
const SellerAnalytics = lazy(() => import('./pages/seller/SellerAnalytics'))
const SellerChats = lazy(() => import('./pages/seller/SellerChats'))
const SellerStore = lazy(() => import('./pages/seller/SellerStore'))

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))

const NotFound = lazy(() => import('./pages/NotFound'))

function AppRoutes() {
  const location = useLocation()

  return (
    <Suspense fallback={<div className="page"><Spinner label="Loading page" /></div>}>

      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>

          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/store/:sellerId" element={<StorePage />} />

          <Route path="/cart" element={
            <ProtectedRoute roles={['customer']}><Cart /></ProtectedRoute>
          } />
          <Route path="/checkout" element={
            <ProtectedRoute roles={['customer']}><Checkout /></ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute roles={['customer']}><Orders /></ProtectedRoute>
          } />
          <Route path="/wishlist" element={
            <ProtectedRoute roles={['customer']}><Wishlist /></ProtectedRoute>
          } />
          <Route path="/messages" element={
            <ProtectedRoute roles={['customer']}><Messages /></ProtectedRoute>
          } />
          <Route path="/messages/:conversationId" element={
            <ProtectedRoute roles={['customer']}><Messages /></ProtectedRoute>
          } />

          <Route path="/notifications" element={
            <ProtectedRoute><Notifications /></ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />

          <Route path="/sell/apply" element={
            <ProtectedRoute roles={['customer']}><SellerApply /></ProtectedRoute>
          } />

          <Route path="/seller" element={
            <ProtectedRoute requireApprovedSeller><SellerOrders /></ProtectedRoute>
          } />
          <Route path="/seller/products" element={
            <ProtectedRoute requireApprovedSeller><SellerProducts /></ProtectedRoute>
          } />
          <Route path="/seller/analytics" element={
            <ProtectedRoute requireApprovedSeller><SellerAnalytics /></ProtectedRoute>
          } />
          <Route path="/seller/chats" element={
            <ProtectedRoute requireApprovedSeller><SellerChats /></ProtectedRoute>
          } />
          <Route path="/seller/chats/:conversationId" element={
            <ProtectedRoute requireApprovedSeller><SellerChats /></ProtectedRoute>
          } />
          <Route path="/seller/store" element={
            <ProtectedRoute requireApprovedSeller><SellerStore /></ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute roles={['admin', 'superadmin']}><AdminDashboard /></ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  )
}

function ConfiguredApp() {
  const { isConfigured } = useAuth()
  if (!isConfigured) return <SetupRequired />
  return <AppRoutes />
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <a className="skip-link" href="#main">Skip to main content</a>
            <ConfiguredApp />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
