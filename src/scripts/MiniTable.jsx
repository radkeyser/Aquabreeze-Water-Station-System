import EmptyState from './EmptyState.jsx';

export default function MiniTable({ columns = [], rows = [], emptyLabel = 'No data', footerLabel, footerValue }) {
  return (
    <>
      <div className="dash-card-thead">
        <table className="dash-mini-table dash-mini-head">
          <colgroup>
            {columns.map((c, i) => (<col key={i} />))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ textAlign: col.align || 'left' }}>{col.label}</th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      <div className="dash-card-body">
        <table className="dash-mini-table dash-mini-body">
          <colgroup>
            {columns.map((c, i) => (<col key={i} />))}
          </colgroup>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="dash-mini-empty">{emptyLabel}</td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.id ?? idx}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ textAlign: col.align || 'left' }}>{col.render ? col.render(row) : row[col.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="dash-card-tfoot">
        <table className="dash-mini-table dash-mini-foot">
          <colgroup>
            {columns.map((c, i) => (<col key={i} />))}
          </colgroup>
          <tfoot>
            <tr>
              <td colSpan={Math.max(1, columns.length - 1)} style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted-fg)' }}>{footerLabel || ''}</td>
              <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '16px' }}>{footerValue || ''}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
