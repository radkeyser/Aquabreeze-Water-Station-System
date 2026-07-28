export function Card({ children, className = '' }) {
  return (
    <div className={`bg-card border border-border rounded-lg shadow ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon: Icon, action, subtitle }) {
  const renderIcon = () => {
    if (!Icon) return null;
    if (typeof Icon === 'string') return <span className="material-icons-outlined text-primary" style={{ fontSize: 18 }}>{Icon}</span>;
    if (typeof Icon === 'function') return <Icon size={18} className="text-primary" />;
    return Icon;
  };

  return (
    <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
      <div>
        <div className="flex items-center gap-2 text-[15px] font-bold text-fg">
          {renderIcon()}
          {title}
        </div>
        {subtitle && <div className="text-xs text-muted-fg mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return <div className={`px-6 pb-6 ${className}`}>{children}</div>;
}