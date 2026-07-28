import clsx from 'clsx';

const VARIANTS = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-dark',
  outline: 'bg-card text-fg border border-border hover:border-primary hover:text-primary',
  ghost: 'bg-muted text-fg hover:bg-border',
  destructive: 'bg-destructive text-destructive-fg hover:opacity-90',
};

export default function Button({
  variant = 'primary',
  icon: Icon,
  className,
  children,
  ...props
}) {
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-2 px-4 py-2 rounded text-[13px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant] || VARIANTS.primary,
        className
      )}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}