export default function EmptyState({ icon: Icon = 'inbox', label = 'Nothing here yet', hint }) {
  const renderIcon = () => {
    if (!Icon) return null;
    if (typeof Icon === 'string') return <span className="material-icons-outlined mb-2 opacity-50" style={{ fontSize: 34 }}>{Icon}</span>;
    if (typeof Icon === 'function') return <Icon size={34} className="mb-2 opacity-50" />;
    return Icon;
  };

  return (
    <div className="flex flex-col items-center justify-center text-center py-10 text-muted-fg">
      {renderIcon()}
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs mt-1">{hint}</p>}
    </div>
  );
}