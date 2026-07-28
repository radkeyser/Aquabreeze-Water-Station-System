import clsx from 'clsx';

/**
 * Dynamic pill-style tab bar. Pass `tabs` as [{ key, label, icon }],
 * the currently `active` key, and `onChange`. Purely presentational —
 * pages own the state and decide what renders below.
 */
export default function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={clsx('flex gap-1 bg-muted rounded p-1 w-fit flex-wrap', className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange?.(tab.key)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-colors',
              isActive ? 'bg-card text-fg shadow-card' : 'text-muted-fg hover:text-fg'
            )}
          >
            {Icon && <Icon size={15} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Underline-style tab bar (used for page-level section tabs like
 * Reports / Inventory / Cash Management sub-navigation).
 */
export function UnderlineTabs({ tabs, active, onChange, className }) {
  return (
    <div className={clsx('flex gap-0 border-b-2 border-border overflow-x-auto scrollbar-thin', className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange?.(tab.key)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-4 pt-2.5 pb-3 -mb-0.5 border-b-[3px] text-[13px] font-semibold whitespace-nowrap transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-fg hover:text-primary'
            )}
          >
            {Icon && <Icon size={16} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}