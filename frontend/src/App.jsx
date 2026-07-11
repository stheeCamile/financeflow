import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Layout/Sidebar';
import Dashboard   from './pages/Dashboard';
import Cards       from './pages/Cards';
import Revenues    from './pages/Revenues';
import Goals       from './pages/Goals';
import WhatsApp    from './pages/WhatsApp';
import Settings    from './pages/Settings';
import Login       from './pages/Login';
import Register    from './pages/Register';
import Installments from './pages/Installments';
import Subscriptions from './pages/Subscriptions';
import Budgets from './pages/Budgets';
import './styles/globals.css';

function AppLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar isOpen={mobileMenuOpen} close={() => setMobileMenuOpen(false)} />
      
      <main className="main-content">
        <div className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          <span className="sidebar-logo-text" style={{ fontSize: 18 }}>FinanceFlow</span>
        </div>
        {children}
      </main>

      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)}></div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Rotas protegidas */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/cartoes" element={
              <ProtectedRoute>
                <AppLayout><Cards /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/receitas" element={
              <ProtectedRoute>
                <AppLayout><Revenues /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/parcelas" element={
              <ProtectedRoute>
                <AppLayout><Installments /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/assinaturas" element={
              <ProtectedRoute>
                <AppLayout><Subscriptions /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/orcamentos" element={
              <ProtectedRoute>
                <AppLayout><Budgets /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/metas" element={
              <ProtectedRoute>
                <AppLayout><Goals /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/whatsapp" element={
              <ProtectedRoute>
                <AppLayout><WhatsApp /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/configuracoes" element={
              <ProtectedRoute>
                <AppLayout><Settings /></AppLayout>
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
