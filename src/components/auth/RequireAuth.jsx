import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RequireAuth({ children }) {
  const { session, authorized, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!session || !authorized) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}