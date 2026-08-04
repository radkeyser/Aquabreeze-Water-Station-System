import { useShift } from '../../../context/ShiftContext.jsx';

export default function ShiftHeaderControl() {
  const { activeShift, loading, openStartModal, openEndModal } = useShift();

  if (loading) return null;

  if (!activeShift) {
    return (
      <button type="button" className="shift-header-btn shift-header-btn-start" onClick={() => openStartModal()}>
        <span className="material-icons-outlined">play_circle</span>
        <span>Start Shift</span>
      </button>
    );
  }

  return (
    <button type="button" className="shift-header-btn shift-header-btn-active" onClick={openEndModal} title={`Shift ${activeShift.shiftId} — started ${activeShift.time}`}>
      <span className="shift-header-dot" />
      <span className="shift-header-label">Shift Open</span>
      <span className="material-icons-outlined" style={{ fontSize: 15 }}>stop_circle</span>
    </button>
  );
}