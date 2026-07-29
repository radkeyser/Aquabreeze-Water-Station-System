// sortable indicator uses material icons
import clsx from 'clsx';
import EmptyState from './EmptyState.jsx';

/**
 * Dynamic, column-config-driven table.
 *
 * columns: [{ key, label, align?, render?(row), sortable?, sortProps? }]
 * rows: array of plain objects
 *
 * This is presentation-only for now � no live sorting/paging wired up
 * yet, just a consistent shell every page can feed data into once the
 * Supabase queries land.
 */
export default function DataTable({ columns, rows = [], emptyLabel = 'No records found', footerData, id, tableClassName, sortCol, sortDir, onSort }) {
  return (
    <table id={id} className={clsx('data-table w-full text-sm border-collapse', tableClassName)}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className="text-left pb-3 text-[13px] font-semibold text-muted-fg border-b border-border whitespace-nowrap"
              style={{ textAlign: col.align || 'left' }}
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                {col.sortable && (
                  <span
                    className={clsx('sort-icon rpt-sort', col.sortProps?.className)}
                    style={col.sortProps?.style}
                    data-col={col.sortProps?.['data-col']}
                    data-table={col.sortProps?.['data-table']}
                    onClick={() => onSort?.(col.key)}
                  >
                    {sortCol === col.key ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
                  </span>
                )}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="py-10">
              <EmptyState label={emptyLabel} />
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-border last:border-none">
              {columns.map((col) => (
                <td key={col.key} className="py-3" style={{ textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {footerData && (
        <tfoot>
          <tr className="rpt-footer-row">
            {columns.map((col, idx) => (
              <td key={col.key} className="text-sm font-semibold" style={{ textAlign: col.align || 'left' }}>
                {idx === 0 ? (footerData.label ?? '') : (footerData[col.key] ?? '')}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
