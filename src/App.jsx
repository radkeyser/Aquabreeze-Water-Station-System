import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layouts/AppLayout.jsx';
import { NAV_ITEMS } from './config/navigation.js';
import { ShiftProvider } from './context/ShiftContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import RequireAuth from './components/auth/RequireAuth.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import StartShiftModal from './components/features/shift/StartShiftModal.jsx';
import EndShiftModal from './components/features/shift/EndShiftModal.jsx';
import ShiftSummaryModal from './components/features/shift/ShiftSummaryModal.jsx';
import './components/features/shift/shift.css';
import './components/auth/auth.css';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
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
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}