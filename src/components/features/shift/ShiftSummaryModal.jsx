import { formatPeso } from '../../../utils/format.js';
import { useShift } from '../../../context/ShiftContext.jsx';

export default function ShiftSummaryModal() {
  const { summaryData, setSummaryData } = useShift();
  if (!summaryData) return null;

  const diff = summaryData.difference ?? (summaryData.actual - summaryData.expected);
  const diffColor = diff >= 0 ? 'hsl(150,45%,38%)' : 'var(--destructive)';

  function close() { setSummaryData(null); }

  return (
    <div className="pay-modal-overlay show">
      <div className="pay-modal" style={{ maxWidth: 400 }}>
        <div className="pay-modal-header">
          <div className="pay-modal-title"><span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6 }}>receipt_long</span> Shift Summary</div>
          <button type="button" className="pdp-close-btn" onClick={close}><span className="material-icons-outlined">close</span></button>
        </div>
        <div className="pay-modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 16 }}>
            <Row label="Starting Cash" value={formatPeso(summaryData.startingCash)} />
            <Row label="Cash Sales" value={formatPeso(summaryData.cashSales)} />
            <Row label="Added Cash" value={formatPeso(summaryData.addedCash)} />
            <Row label="Cash Expenses" value={formatPeso(summaryData.cashExpenses)} color="var(--destructive)" />
            <Row label="Expected Cash" value={formatPeso(summaryData.expected)} strong />
            <Row label="Actual Cash" value={formatPeso(summaryData.actual)} strong />
            <Row label="Difference" value={`${diff >= 0 ? '+' : ''}${formatPeso(diff)}`} strong color={diffColor} />
          </div>
          <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={close}>Done</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--muted-fg)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: strong ? 800 : 700, color: color || 'inherit' }}>{value}</span>
    </div>
  );
}