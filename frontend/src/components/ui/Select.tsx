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
      {label && <label htmlFor={selectId} className="text-sm font-medium font-body text-[#a8a294]">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'w-full px-3 py-2 pr-10 text-sm rounded-[10px] appearance-none font-body',
            'bg-[#171510] text-[#f0ede4]',
            'border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-rose-800/60 focus:ring-rose-500/40 focus:border-rose-500'
              : 'border-[rgba(245,240,230,0.08)] focus:ring-amber-500/40 focus:border-amber-500/60',
            fullWidth && 'w-full', !value && 'text-[#6c675c]', className
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
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#6c675c]">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {(error || helperText) && (
        <p className={cn('text-xs font-body', error ? 'text-rose-400' : 'text-[#6c675c]')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
