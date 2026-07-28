import { formatPeso } from '../../../src/utils/format.js';

function badgeClass(status) {
  const st = String(status || '').toLowerCase();
  if (st === 'paid') return 'badge-success';
  if (st === 'partial') return 'badge-warning';
  if (st === 'tocharge' || st === 'to charge') return 'badge-tocharge';
  return 'badge-danger';
}

function productStr(product, qty, slimPoly) {
  const base = product + (qty ? ` × ${qty}` : '');
  if (slimPoly && product === '5 Gallon') return `${base} (${slimPoly})`;
  return base;
}

function PointPersonWidget({ orderIds, currentPP, deliveryBoys, onSave }) {
  return (
    <span className="pc-pp-wrap">
      {currentPP
        ? <span className="pc-pp">{currentPP}</span>
        : <span className="pc-pp-empty">No point person</span>}
      <button
        type="button"
        className="pc-pp-edit-btn"
        title="Change point person"
        onClick={(e) => {
          e.stopPropagation();
          onSave(orderIds, currentPP, e.currentTarget);
        }}
      >
        <span className="material-icons-outlined">edit</span>
      </button>
    </span>
  );
}

function OrderBreakdown({ orders, shiftOpen, customerName, onPay }) {
  return (
    <div className="pc-breakdown">
      <div className="pc-breakdown-title">
        <span className="material-icons-outlined">receipt_long</span>
        Order Breakdown
      </div>
      {orders.map((o) => {
        const oProd = o.product + (o.slimPoly && o.product === '5 Gallon' ? ` (${o.slimPoly})` : '');
        return (
          <div key={o.id} className="pc-order-row">
            <div className="pc-order-cell pc-order-cell-id">
              <span className="mono-label">{o.id}</span>
              {o.time
                ? <span className="pc-order-time"><span className="material-icons-outlined">schedule</span>{o.time}</span>
                : <span className="pc-order-time" style={{ fontStyle: 'italic' }}>—</span>}
            </div>
            <div className="pc-order-cell pc-order-cell-prod">
              <span className="pc-order-product">{oProd}</span>
              <span className="pc-order-product-sub">x {o.qty}</span>
            </div>
            <div className="pc-order-cell pc-order-cell-hist">
              {o.payHistory?.length
                ? o.payHistory.map((h, idx) => (
                  <div key={idx} className="pc-order-hist-row">
                    <span className="pc-order-hist-date">{h.date}{h.time ? ` · ${h.time}` : ''}</span>
                    <span className="pc-order-hist-desc">{h.description || 'Payment'}</span>
                    <span className="pc-order-hist-amt">+{formatPeso(h.amount)}</span>
                  </div>
                ))
                : <span className="pc-order-hist-empty">No payments yet</span>}
            </div>
            <div className="pc-order-cell pc-order-cell-amt">
              {o.alreadyPaid > 0 && (
                <>
                  <span className="pc-order-total">{formatPeso(o.orderTotal)}</span>
                  <span className="pc-order-paid">−{formatPeso(o.alreadyPaid)}</span>
                </>
              )}
              <span className="pc-order-balance">{formatPeso(o.amount)}</span>
            </div>
            <div className="pc-order-cell pc-order-cell-status">
              <span className={`badge ${badgeClass(o.status)}`}>{o.status}</span>
            </div>
            <div className="pc-order-cell pc-order-cell-action">
              {shiftOpen && o.amount > 0 ? (
                <button
                  type="button"
                  className="pay-btn pay-btn-sm"
                  onClick={() => onPay([o.id], o.amount, customerName, `${oProd} x ${o.qty}`)}
                >
                  <span className="material-icons-outlined">payments</span> Pay
                </button>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>No shift</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PautangCard({
  credit,
  shiftOpen,
  hidden,
  expanded,
  onToggleExpand,
  onToggleHide,
  onPay,
  onEditPointPerson,
}) {
  const displayName = credit.customerName || credit.customer || credit.customerId || '—';
  const st = String(credit.status || '');
  const stLower = st.toLowerCase();
  const isSettled = stLower === 'paid' || stLower === 'charged';
  const isToCharge = stLower === 'tocharge' || stLower === 'to charge';
  const balance = credit.amount;
  const prodLabel = productStr(credit.product, credit.qty, credit.slimPoly);
  const orders = credit.orders || [];
  const hasBreakdown = orders.length > 1;

  return (
    <div
      className={`pc-card${isToCharge ? ' pc-tocharge' : ''}${hidden ? ' pc-row-hidden' : ''}${expanded ? ' pc-expanded' : ''}`}
      data-customer={displayName.toLowerCase()}
      data-id={String(credit.id).toLowerCase()}
      data-pautangid={(credit.pautangId || '').toLowerCase()}
      data-pointperson={(credit.pointPerson || '').toLowerCase()}
      data-date={credit.date}
      data-product={(credit.product || '').toLowerCase()}
      data-location={(credit.location || '').toLowerCase()}
      data-amount={balance}
      data-status={stLower}
    >
      <div className="pc-header">
        <div className="pc-header-left">
          <div className="pc-name-row">
            <button
              type="button"
              className="pc-hide-btn"
              title={hidden ? 'Unhide row' : 'Hide row'}
              onClick={(e) => { e.stopPropagation(); onToggleHide(credit); }}
            >
              <span className="material-icons-outlined">{hidden ? 'visibility_off' : 'visibility'}</span>
            </button>
            <div className="pc-customer">
              {displayName}
              <span className="pc-product-inline">{prodLabel}</span>
              {isToCharge && (
                <span className="tocharge-tag">
                  <span className="material-icons-outlined">pending_actions</span>
                  To Charge
                </span>
              )}
            </div>
            <span className="pc-collapsed-id">{credit.id}</span>
          </div>
          <div className="pc-meta">
            <span className="mono-label">{credit.id}</span>
            {' · '}{credit.date}
            {' · '}
            <PointPersonWidget
              orderIds={credit.orderIds || [credit.id]}
              currentPP={credit.pointPerson}
              onSave={onEditPointPerson}
            />
            {credit.location && (
              <> · <span className="pc-loc">{credit.location}</span></>
            )}
          </div>
        </div>
        <div className="pc-header-right">
          <span className="pc-balance">{formatPeso(balance)}</span>
          <span className={`badge ${badgeClass(st)}`}>{st}</span>
          {!isSettled && shiftOpen && balance > 0 && (
            <button
              type="button"
              className="pay-btn"
              onClick={() => onPay(
                credit.orderIds || [credit.id],
                balance,
                displayName,
                prodLabel,
                hasBreakdown,
                credit
              )}
            >
              <span className="material-icons-outlined">payments</span> Pay
            </button>
          )}
          <button
            type="button"
            className="pc-toggle"
            title="View details"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(credit.id); }}
          >
            <span className="material-icons-outlined">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pc-body">
          {hasBreakdown && (
            <OrderBreakdown
              orders={orders}
              shiftOpen={shiftOpen}
              customerName={displayName}
              onPay={onPay}
            />
          )}
          <div className="pc-details">
            <div className="pc-detail-item">
              <div className="pc-detail-label">Product</div>
              <div className="pc-detail-val">{prodLabel}</div>
            </div>
            <div className="pc-detail-item">
              <div className="pc-detail-label">Order Total</div>
              <div className="pc-detail-val">{formatPeso(credit.orderTotal)}</div>
            </div>
            <div className="pc-detail-item">
              <div className="pc-detail-label">Already Paid</div>
              <div className="pc-detail-val text-success">{formatPeso(credit.alreadyPaid)}</div>
            </div>
            <div className="pc-detail-item">
              <div className="pc-detail-label">Balance</div>
              <div className="pc-detail-val text-danger text-bold">{formatPeso(balance)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
