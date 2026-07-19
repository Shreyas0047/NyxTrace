import { forwardRef, useId } from 'react';
import { cn } from '../../design-system';
import { AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, helperText, leftIcon, rightIcon, fullWidth = false, className, id, ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || `input-${generatedId}`;

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#a8a294] font-body">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6c675c]">{leftIcon}</div>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-[10px] font-body',
            'bg-[#171510] text-[#f0ede4]',
            'placeholder:text-[#6c675c]',
            'border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-rose-800/60 focus:ring-rose-500/40 focus:border-rose-500'
              : 'border-[rgba(245,240,230,0.08)] focus:ring-amber-500/40 focus:border-amber-500/60',
            leftIcon && 'pl-10', rightIcon && 'pr-10', fullWidth && 'w-full', className
          )}
          {...props}
        />
        {error && !rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>
      {(error || helperText) && (
        <p className={cn('text-xs font-body', error ? 'text-rose-400' : 'text-[#6c675c]')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label, error, helperText, fullWidth = false, className, id, ...props
}, ref) => {
  const generatedId = useId();
  const textareaId = id || `textarea-${generatedId}`;

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && <label htmlFor={textareaId} className="text-sm font-medium text-[#a8a294] font-body">{label}</label>}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-[10px] resize-y min-h-[80px] font-body',
          'bg-[#171510] text-[#f0ede4]',
          'placeholder:text-[#6c675c]',
          'border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0',
          error ? 'border-rose-800/60 focus:ring-rose-500/40 focus:border-rose-500' : 'border-[rgba(245,240,230,0.08)] focus:ring-amber-500/40 focus:border-amber-500/60',
          fullWidth && 'w-full', className
        )}
        {...props}
      />
      {(error || helperText) && (
        <p className={cn('text-xs font-body', error ? 'text-rose-400' : 'text-[#6c675c]')}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Input;
