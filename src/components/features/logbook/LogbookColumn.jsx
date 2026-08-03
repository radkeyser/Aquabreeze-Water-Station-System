import { formatPeso } from '../../../utils/format.js';
import LogbookCard, { formatDateLabel } from './LogbookCard.jsx';

export default function LogbookColumn({
  title,
  colKey,
  entries,
  groupMode,
  hiddenCandidate,
  massSelectMode,
  selectedLogIds,
  onCardClick,
  onToggleSelect,
  onTipClick,
  onPayClick,
  onHideColumn,
  onClaimAllTips,
  onDragStart,
  onDragEnd,
  onDragOverColumn,
  onDropColumn,
}) {
  const delivered = entries.filter((e) => e.status === 'Delivered').length;
  const total = entries.length;
  const pct = total ? Math.round((delivered / total) * 100) : 0;
  const totalUtang = entries.reduce((s, e) => (String(e.paymentStatus || 'Paid').toLowerCase() === 'paid' ? s : s + (e.paymentBalance || 0)), 0);
  const totalTips = entries.reduce((s, e) => s + (e.tip || 0), 0);
  const unclaimedEntries = entries.filter((e) => e.tip > 0 && !e.tipClaimed);
  const unclaimedTotal = unclaimedEntries.reduce((s, e) => s + e.tip, 0);
  const initials = title === 'No Point Person' ? '—' : title.trim().split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase();

  const groups = {};
  const order = [];
  if (groupMode === 'location') {
    entries.forEach((e) => {
      const key = e.location?.trim() || 'NO LOCATION';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(e);
    });
    order.sort((a, b) => (a === 'NO LOCATION' ? 1 : b === 'NO LOCATION' ? -1 : a.localeCompare(b)));
  } else {
    entries.forEach((e) => {
      if (!groups[e.date]) { groups[e.date] = []; order.push(e.date); }
      groups[e.date].push(e);
    });
    order.sort((a, b) => new Date(b) - new Date(a));
  }

  return (
    <div
      className="lb-col"
      data-person={colKey}
      onDragOver={(ev) => onDragOverColumn(ev)}
      onDrop={(ev) => onDropColumn(ev, colKey === 'no point person' ? '' : title)}
    >
      <div className="lb-col-header">
        <div className="lb-col-header-top">
          <div className="lb-col-identity">
            <span className={`lb-col-avatar${title === 'No Point Person' ? ' lb-col-avatar-none' : ''}`}>{initials}</span>
            <span className="lb-col-title">{title}</span>
            <span className="lb-col-count">{total}</span>
          </div>
          <button type="button" className="lb-col-hide-btn" title="Hide column" onClick={() => onHideColumn(colKey, title)}>
            <span className="material-icons-outlined">visibility_off</span>
          </button>
        </div>
        {total > 0 && (
          <>
            <div className="lb-col-progress"><div className="lb-col-progress-fill" style={{ width: `${pct}%` }} /></div>
            <div className="lb-col-meta">{delivered}/{total} delivered</div>
          </>
        )}
        {(totalUtang > 0 || totalTips > 0 || unclaimedTotal > 0) && (
          <div className="lb-col-stats">
            {totalUtang > 0 && <span className="lb-col-utang" title="Outstanding utang">{formatPeso(totalUtang)}</span>}
            {totalTips > 0 && <span className="lb-col-tips" title="Total tips">+{formatPeso(totalTips)}</span>}
            {unclaimedTotal > 0 && (
              <button type="button" className="lb-col-tips-unclaimed" title="Tap to claim all" onClick={() => onClaimAllTips(title, unclaimedEntries)}>
                {formatPeso(unclaimedTotal)} unclaimed
              </button>
            )}
          </div>
        )}
      </div>

      <div className="lb-col-body">
        {entries.length === 0 ? (
          <div className="lb-empty"><span className="material-icons-outlined">inbox</span>No deliveries</div>
        ) : (
          order.map((groupKey) => (
            <div className="lb-date-group" key={groupKey}>
              <div className="lb-date-label">
                {groupMode === 'location' ? groupKey.toUpperCase() : formatDateLabel(groupKey)}
                <span className="lb-date-count">{groups[groupKey].length}</span>
              </div>
              {groups[groupKey].map((e) => (
                <LogbookCard
                  key={e.logId}
                  entry={e}
                  massSelectMode={massSelectMode}
                  selected={selectedLogIds.has(e.logId)}
                  draggable={e.status !== 'Delivered'}
                  onCardClick={onCardClick}
                  onToggleSelect={onToggleSelect}
                  onTipClick={onTipClick}
                  onPayClick={onPayClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}