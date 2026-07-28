import clsx from 'clsx';

const VARIANTS = {
  success: 'bg-accent text-accent-fg',
  warning: 'bg-muted text-muted-fg',
  danger: 'bg-destructive-light text-destructive',
  neutral: 'bg-muted text-muted-fg',
};

export default function Badge({ variant = 'neutral', className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize',
        VARIANTS[variant] || VARIANTS.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}