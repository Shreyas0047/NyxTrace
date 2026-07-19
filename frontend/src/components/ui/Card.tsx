import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../design-system';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'ghost' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export function Card({
  children,
  className,
  variant = 'default',
  padding = 'md',
  hover = false,
}: CardProps) {
  const variantClasses = {
    default: 'bg-[#171510] border border-[rgba(245,240,230,0.05)] shadow-sm',
    elevated: 'bg-[#1e1b14] border border-[rgba(245,240,230,0.08)] shadow-md',
    bordered: 'bg-[#171510] border-2 border-[#3a3730]',
    ghost: 'bg-transparent border border-transparent',
    accent: 'bg-[#171510] border border-[rgba(245,158,11,0.2)] shadow-sm',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      whileHover={hover ? { y: -2 } : undefined}
      className={cn(
        'rounded-[20px]',
        variantClasses[variant],
        paddingClasses[padding],
        hover && 'cursor-pointer transition-shadow duration-200 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_4px_20px_rgba(245,158,11,0.04)]',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, action, className, children }: CardHeaderProps) {
  if (children) {
    return (
      <div className={cn('px-5 py-4 border-b border-[rgba(245,240,230,0.05)]', className)}>
        {children}
      </div>
    );
  }

  return (
    <div className={cn('flex items-start justify-between px-5 py-4 border-b border-[rgba(245,240,230,0.05)]', className)}>
      <div>
        {title && (
          <h3 className="font-display text-base font-semibold text-[#f0ede4]">
            {title}
          </h3>
        )}
        {description && (
          <p className="mt-0.5 text-sm text-[#a8a294] font-body">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('p-5', className)}>
      {children}
    </div>
  );
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('px-5 py-4 border-t border-[rgba(245,240,230,0.05)] bg-[#14120d]/50 rounded-b-[20px]', className)}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Content = CardContent;
Card.Footer = CardFooter;

export default Card;
