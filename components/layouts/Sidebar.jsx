import { NavLink } from 'react-router-dom';
// use material icons for sidebar branding and NAV_ITEMS icons
import clsx from 'clsx';
import { NAV_ITEMS } from '../../src/config/navigation.js';

export default function Sidebar({ expanded = false, setExpanded = () => {} }) {
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
              to={item.path}
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
    </aside>
  );
}