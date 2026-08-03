import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';

export default function MainLayout() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <Sidebar expanded={expanded} setExpanded={setExpanded} />
      <div className="main-wrapper" style={{ marginLeft: expanded ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width)' }}>
        <div className="content-area">
          <Header onMenuClick={() => setExpanded((s) => !s)} />
          <main className="page-content scrollbar-thin">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}