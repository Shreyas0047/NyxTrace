import { forwardRef, useId } from 'react';
import { cn } from '../../design-system';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, error, helperText, options, placeholder = 'Select an option', fullWidth = false, onChange, className, id, value, ...props
}, ref) => {
  const generatedId = useId();
  const selectId = id || `select-${generatedId}`;
  const hasEmptyOption = options.some((option) => option.value === '');

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && <label htmlFor={selectId} className="text-sm font-medium font-body text-[var(--text-secondary)]">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'w-full px-3 py-2 pr-10 text-sm rounded-[10px] appearance-none font-body',
            'bg-[var(--surface-raised)] text-[var(--text-primary)]',
            'border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-rose-500/60 focus:ring-rose-500/40 focus:border-rose-500'
              : 'border-[var(--border-default)] focus:ring-amber-500/40 focus:border-amber-500/60',
            fullWidth && 'w-full', !value && 'text-[var(--text-tertiary)]', className
          )}
          {...props}
        >
          {!hasEmptyOption && <option value="" disabled>{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {(error || helperText) && (
        <p className={cn('text-xs font-body', error ? 'text-rose-500' : 'text-[var(--text-tertiary)]')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
