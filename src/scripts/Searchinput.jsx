// use material icons
import clsx from 'clsx';

export default function SearchInput({ placeholder = 'Search...', className, inputClassName, id, ...props }) {
  return (
    <div className={clsx('relative flex-1 min-w-[180px]', className)}>
      <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg" style={{ fontSize: 16 }}>search</span>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        className={clsx('w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded outline-none focus:border-primary transition-colors bg-card', inputClassName)}
        {...props}
      />
    </div>
  );
}
