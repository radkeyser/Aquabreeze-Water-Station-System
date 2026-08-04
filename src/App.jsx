import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layouts/AppLayout.jsx';
import { NAV_ITEMS } from './config/navigation.js';
import { ShiftProvider } from './context/ShiftContext.jsx';
import StartShiftModal from './components/features/shift/StartShiftModal.jsx';
import EndShiftModal from './components/features/shift/EndShiftModal.jsx';
import ShiftSummaryModal from './components/features/shift/ShiftSummaryModal.jsx';
import './components/features/shift/shift.css';

export default function App() {
  return (
    <ShiftProvider>
      <AppLayout>
        <Routes>
          {NAV_ITEMS.map(({ key, path, element: Component }) => (
            <Route key={key} path={path} element={<Component />} />
          ))}
        </Routes>
      </AppLayout>
      <StartShiftModal />
      <EndShiftModal />
      <ShiftSummaryModal />
    </ShiftProvider>
  );
}