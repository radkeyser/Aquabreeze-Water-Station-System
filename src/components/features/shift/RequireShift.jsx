import { useShift } from '../../../context/ShiftContext.jsx';

export default function RequireShift({ children }) {
  const { activeShift, loading, openStartModal } = useShift();

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;

  if (!activeShift) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <span className="material-icons-outlined" style={{ fontSize: 42, color: 'var(--muted-fg)' }}>play_circle</span>
        <p style={{ color: 'var(--muted-fg)', marginTop: 10, marginBottom: 16 }}>No active shift. Start a shift to continue.</p>
        <button type="button" className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => openStartModal()}>
          <span className="material-icons-outlined" style={{ fontSize: 17, verticalAlign: 'middle' }}>play_arrow</span> Start Shift
        </button>
      </div>
    );
  }

  return children;
}