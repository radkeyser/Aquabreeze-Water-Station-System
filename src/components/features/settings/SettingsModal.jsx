export default function SettingsModal({ open, onClose, title, children, maxWidth = 420 }) {
  if (!open) return null;
  return (
    <div
      className="pay-modal-overlay show"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className="pay-modal" style={{ maxWidth, width: '95%' }}>
        <div className="pay-modal-header">
          <div className="pay-modal-title">{title}</div>
          <button type="button" className="pdp-close-btn" onClick={onClose} aria-label="Close">
            <span className="material-icons-outlined">close</span>
          </button>
        </div>
        <div className="pay-modal-body">{children}</div>
      </div>
    </div>
  );
}
