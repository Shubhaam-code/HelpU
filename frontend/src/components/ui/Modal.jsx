import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Helpu Modal Component
 * 
 * Provides accessible, responsive dialog with backdrop blur,
 * smooth animations, accessible close button, and escape key handling.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-md',
  showCloseButton = true,
  actions = null
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`relative bg-white rounded-[28px] w-full ${maxWidth} p-5 sm:p-6 border border-[#F4E3D8] shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between pb-3 border-b border-[#F4E3D8]/60 shrink-0">
            <div>
              {title && (
                <h3 id="modal-title" className="font-black text-[#17233C] text-base sm:text-lg">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-[#6E7587] font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full text-[#6E7587] hover:text-[#17233C] hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {children}
        </div>

        {/* Footer Actions */}
        {actions && (
          <div className="pt-3 border-t border-[#F4E3D8]/60 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;

