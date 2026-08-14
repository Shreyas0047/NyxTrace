import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../design-system';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, size = 'md', className, children }: ModalProps) {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[rgba(30,27,20,0.42)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              'relative w-full flex flex-col max-h-[90vh] bg-[var(--surface-container-low)]  rounded-2xl border border-[var(--border-default)] overflow-hidden',
              'shadow-[0_24px_64px_rgba(30,27,20,0.16),0_8px_24px_rgba(30,27,20,0.10)]',
              sizes[size],
              className
            )}
          >
            {title && (
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] ">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] ">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-container-high)]  transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--text-secondary)] " />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default Modal;