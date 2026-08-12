import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NAV_ITEMS } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Sidebar({ expanded = false, setExpanded = () => {} }) {
  const { signOut } = useAuth();

  return (
    <aside
      id="sidebar"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`sidebar ${expanded ? 'open' : ''}`}
    >
      <div className="sidebar-logo">
        <span className="material-icons-outlined logo-icon" style={{ fontSize: 34 }}>opacity</span>
        <span className="sidebar-brand">AQUA BREEZE</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.path.replace(/\/\*$/, '')}
              end={item.path === '/'}
              className={({ isActive }) =>
                clsx('sidebar-btn', isActive ? 'active' : '')
              }
            >
              {typeof Icon === 'string' ? <span className="material-icons-outlined" style={{ fontSize: 22 }}>{Icon}</span> : <Icon size={22} />}
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <button type="button" className="sidebar-btn sidebar-logout" onClick={signOut} style={{ marginTop: 'auto', marginBottom: 12, cursor: 'pointer', border: 'none', background: 'none', width: '100%' }}>
        <span className="material-icons-outlined" style={{ fontSize: 22 }}>logout</span>
        <span className="sidebar-label">Logout</span>
      </button>
    </aside>
  );
}