import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../layouts/Sidebar.jsx';
import Header from '../layouts/Header.jsx';
import { getNavItemByPath } from '../../config/navigation.js';

export default function AppLayout({ children }) {
  const { pathname } = useLocation();
  const navItem = getNavItemByPath(pathname);
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <Sidebar expanded={expanded} setExpanded={setExpanded} />
      <div className={`main-wrapper`} style={{ marginLeft: expanded ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width)' }}>
        <div className="content-area">
          <Header navItem={navItem} onMenuClick={() => setExpanded((s) => !s)} />
          <main className="page-content" id="pageContent">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}