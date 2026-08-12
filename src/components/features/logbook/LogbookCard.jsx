import { formatPeso } from '../../../utils/format.js';

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export default function LogbookCard({
  entry: e,
  massSelectMode,
  selected,
  draggable,
  onCardClick,
  onToggleSelect,
  onTipClick,
  onPayClick,
  onDragStart,
  onDragEnd,
}) {
  const stCls = e.status === 'Delivered' ? 'lb-card-delivered' : e.status === 'Partial' ? 'lb-card-partial' : 'lb-card-undelivered';
  const stLabel = e.status === 'Delivered' ? 'Delivered' : e.status === 'Partial' ? 'Partial' : 'Pending';
  const payStatus = String(e.paymentStatus || 'Paid').toLowerCase();
  const showPayBtn = !e.isClosedSplitHalf && payStatus !== 'paid' && e.paymentBalance > 0;

  return (
    <div
      className={`lb-card ${stCls}${selected ? ' lb-card-selected' : ''}`}
      draggable={draggable}
      onDragStart={(ev) => onDragStart(ev, e)}
      onDragEnd={onDragEnd}
      onClick={() => (massSelectMode ? onToggleSelect(e) : onCardClick(e))}
    >
      {e.status !== 'Delivered' && massSelectMode && (
        <input
          type="checkbox"
          className="lb-card-checkbox"
          style={{ position: 'absolute', top: 10, right: 10, width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', zIndex: 3 }}
          checked={!!selected}
          onChange={() => onToggleSelect(e)}
          onClick={(ev) => ev.stopPropagation()}
        />
      )}

      <div className="lb-card-head">
        <div className="lb-card-titleblock">
          <div className="lb-card-customer">{e.customerName || '—'}</div>
          <div className="lb-card-sub">
            {e.location && <span className="lb-card-sub-item"><span className="material-icons-outlined">location_on</span>{e.location}</span>}
            <span className="lb-card-sub-item"><span className="material-icons-outlined">schedule</span>{e.time || '—'}</span>
          </div>
        </div>
        <span className={`lb-status-chip lb-status-chip-${(e.status || 'Undelivered').toLowerCase()}`}>{stLabel}</span>
      </div>

      {e.deliveryAttempts > 1 && (
        <div className="lb-card-attempts" title={`${e.deliveryAttempts} delivery attempts`}>
          <span className="material-icons-outlined">history</span>{e.deliveryAttempts} delivery attempts
        </div>
      )}

      <div className="lb-card-body">
        <div className="lb-card-product">
          <span className="material-icons-outlined">water_drop</span>
          <span className="lb-card-product-name">{e.product}</span>
          <span className="lb-card-qty">×{e.qty}</span>
        </div>
        {e.tip > 0 && (
          <button
            type="button"
            className={`lb-card-tip${e.tipClaimed ? ' lb-card-tip-claimed' : ''}`}
            title={e.tipClaimed ? 'Tip claimed — click to unclaim' : 'Click to mark tip as claimed'}
            onClick={(ev) => { ev.stopPropagation(); onTipClick(e); }}
          >
            <span className="material-icons-outlined">{e.tipClaimed ? 'check_circle' : 'savings'}</span>+{formatPeso(e.tip)}
          </button>
        )}
      </div>

      {e.status === 'Partial' && e.deliveredQty > 0 && (
        <div className="lb-card-partial-progress">
          <div className="lb-card-partial-bar"><div className="lb-card-partial-fill" style={{ width: `${e.qty > 0 ? Math.round((e.deliveredQty / e.qty) * 100) : 0}%` }} /></div>
          <div className="lb-card-partial-text">{e.deliveredQty}/{e.qty} delivered · <span className="lb-card-partial-remaining">{e.qty - e.deliveredQty} left</span></div>
        </div>
      )}

      {e.notes?.trim() && (
        <div className="lb-card-notes" title={e.notes}>
          <span className="material-icons-outlined">sticky_note_2</span>
          <span className="lb-card-notes-text">{e.notes}</span>
        </div>
      )}

      <div className="lb-card-foot">
        <div className="lb-card-foot-left">
          {!e.isClosedSplitHalf && (payStatus === 'paid' || !(e.paymentBalance > 0) ? (
            <span className="lb-pay-dot lb-pay-dot-paid"><span className="material-icons-outlined">check</span>Paid</span>
          ) : showPayBtn && (
            <button
              type="button"
              className={`lb-pay-btn ${payStatus === 'partial' ? 'lb-pay-btn-partial' : 'lb-pay-btn-utang'}`}
              title="Record payment"
              onClick={(ev) => { ev.stopPropagation(); onPayClick(e); }}
            >
              <span className="material-icons-outlined">payments</span>{formatPeso(e.paymentBalance)}
            </button>
          ))}
          {(e.deliveredTime || e.deliveredDate) && (
            <span className="lb-card-stamp lb-card-stamp-done">
              <span className="material-icons-outlined">local_shipping</span>
              {e.deliveredDate ? `${formatDateLabel(e.deliveredDate)} ` : ''}{e.deliveredTime || ''}
            </span>
          )}
        </div>
        <div className="lb-card-actions"><span className="lb-card-orderid">{e.orderId || ''}</span></div>
      </div>
    </div>
  );
}

export { formatDateLabel };