const STAT_BG = {
  1: 'bg-stat-1',
  2: 'bg-stat-2',
  3: 'bg-stat-3',
  4: 'bg-stat-4',
};

/** Colored stat tile, e.g. Dashboard's Total Sales / Orders / Expenses row. */
export function StatCard({ icon: Icon, label, value = '—', tone = 1 }) {
  return (
    <div className={`relative overflow-hidden rounded-lg p-5 text-white ${STAT_BG[tone] || STAT_BG[1]}`}>
      <div className="absolute -top-8 -right-2 w-24 h-24 rounded-full bg-white/20" />
      <div className="relative">
        <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center mb-3">
          {Icon && <Icon size={18} className="text-white/70" />}
        </div>
        <div className="text-2xl font-extrabold">{value}</div>
        <div className="text-[13px] text-white/70 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

const TONE_ICON_BG = {
  primary: 'bg-primary-light text-primary',
  success: 'bg-[hsl(150,40%,92%)] text-secondary',
  danger: 'bg-destructive-light text-destructive',
};

/** Neutral card with an icon chip + label/value, e.g. summary rows. */
export function SummaryCard({ icon: Icon, label, value = '—', tone = 'primary' }) {
  return (
    <div className="bg-card border border-border rounded-lg shadow p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded flex items-center justify-center flex-shrink-0 ${TONE_ICON_BG[tone]}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div>
        <div className="text-xs text-muted-fg">{label}</div>
        <div className="text-[22px] font-extrabold text-fg">{value}</div>
      </div>
    </div>
  );
}