import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, RefreshCw, ShieldAlert } from 'lucide-react';

export function CancelBookingModal({
  isOpen,
  onClose,
  onConfirm,
  isCancelling = false,
  error = ''
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isCancelling) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-white rounded-[26px] sm:rounded-[30px] p-5 sm:p-7 max-w-sm sm:max-w-md w-full border border-[#F4E3D8] shadow-2xl relative overflow-hidden"
        >
          {/* Close button */}
          <button
            type="button"
            disabled={isCancelling}
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FFF8F3] hover:bg-[#F4E3D8] text-[#6E7587] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Header */}
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-3.5 shadow-2xs">
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.3]" />
            </div>

            {/* Title */}
            <h3 className="font-black text-lg sm:text-xl text-[#17233C] mb-1.5">
              Cancel Booking?
            </h3>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[#17233C] font-semibold leading-relaxed">
              Are you sure you want to cancel this booking?
            </p>

            {/* Supporting text */}
            <p className="text-[11px] sm:text-xs text-[#6E7587] font-medium mt-1 leading-relaxed max-w-xs">
              Your reserved seat will be released after successful cancellation.
            </p>
          </div>

          {/* Useful Error message if cancellation fails */}
          {error && (
            <div className="mt-3.5 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2 text-left">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              disabled={isCancelling}
              onClick={onClose}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-[#F4E3D8] bg-[#FFFBF8] hover:bg-[#FFF4ED] text-[#17233C] text-xs sm:text-sm font-black transition-all cursor-pointer disabled:opacity-50 order-2 sm:order-1"
            >
              Keep My Booking
            </button>

            <button
              type="button"
              disabled={isCancelling}
              onClick={onConfirm}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white text-xs sm:text-sm font-black shadow-md shadow-red-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 order-1 sm:order-2"
            >
              {isCancelling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <span>Yes, Cancel Booking</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CancelBookingModal;

