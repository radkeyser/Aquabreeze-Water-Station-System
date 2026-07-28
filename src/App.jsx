import { Routes, Route } from 'react-router-dom';
import AppLayout from '../components/layouts/AppLayout.jsx';
import { NAV_ITEMS } from './config/navigation.js';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        {NAV_ITEMS.map(({ key, path, element: Component }) => (
          <Route key={key} path={path} element={<Component />} />
        ))}
      </Routes>
    </AppLayout>
  );
}
