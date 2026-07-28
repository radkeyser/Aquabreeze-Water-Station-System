export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
      <div>
        <h1 className="text-lg font-extrabold text-fg">{title}</h1>
        {subtitle && <p className="text-xs text-muted-fg mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const BADGE_TONE = {
  success: 'bg-primary-light text-primary-dark',
  warning: 'bg-muted text-muted-fg',
  danger: 'bg-destructive-light text-destructive',
  neutral: 'bg-muted text-muted-fg',
};

export function Badge({ children, tone = 'neutral' }) {
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${BADGE_TONE[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="text-center py-16 text-muted-fg">
      {Icon && <Icon size={36} className="mx-auto mb-3 text-border" />}
      <h2 className="text-fg font-semibold mb-1">{title}</h2>
      {subtitle && <p className="text-sm">{subtitle}</p>}
    </div>
  );
}

/** Placeholder rows/cols so a table's shape is visible before data wiring. */
export function TableSkeleton({ columns = [], rows = 4 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left font-semibold text-xs text-muted-fg pb-3 border-b border-border pr-4 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-border last:border-none">
              {columns.map((c) => (
                <td key={c} className="py-3 pr-4">
                  <div className="h-3 w-full max-w-[120px] rounded bg-muted animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}