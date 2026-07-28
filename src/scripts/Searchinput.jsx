// use material icons
import clsx from 'clsx';

export default function SearchInput({ placeholder = 'Search...', className, inputClassName, id, ...props }) {
  return (
    <div className={clsx('relative flex-1 min-w-[180px]', className)}>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        className={clsx('w-full pl-3 pr-3 py-2.5 text-sm border border-border rounded outline-none focus:border-primary transition-colors bg-card', inputClassName)}
        {...props}
      />
    </div>
  );
}
