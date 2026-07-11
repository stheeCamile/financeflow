import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CreditCard, TrendingUp, Target, MessageCircle, Settings, LogOut, Package, Repeat, PieChart, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/cartoes',       icon: CreditCard,      label: 'Contas/Cartões'},
  { to: '/receitas',      icon: TrendingUp,      label: 'Receitas'      },
  { to: '/parcelas',      icon: Package,         label: 'Parcelas'      },
  { to: '/assinaturas',   icon: Repeat,          label: 'Assinaturas'   },
  { to: '/orcamentos',    icon: PieChart,        label: 'Orçamentos'    },
  { to: '/metas',         icon: Target,          label: 'Metas'         },
  { to: '/whatsapp',      icon: MessageCircle,   label: 'WhatsApp'      },
  { to: '/configuracoes', icon: Settings,        label: 'Configurações' },
];

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export default function Sidebar({ isOpen, close }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <button className="mobile-close-btn" onClick={close}>
        <X size={20} />
      </button>

      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="sidebar-logo-text">FinanceFlow</span>
      </div>

      {/* Nav */}
      <p className="sidebar-section-title">Menu</p>
      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={close}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon size={18} className="sidebar-icon" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuário + Logout */}
      {user && (
        <div style={{
          borderTop: '1px solid var(--bg-border)',
          paddingTop: 16,
          marginTop: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 12px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {getInitials(user.name)}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>
          <button
            className="sidebar-link"
            style={{ width: '100%', color: 'var(--red)', background: 'none', border: 'none' }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </div>
      )}
    </aside>
  );
}
