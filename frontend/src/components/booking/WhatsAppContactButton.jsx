import { useState } from 'react';
import { MessageCircle, ExternalLink, Loader2 } from 'lucide-react';
import { getWhatsAppDetails } from '../../lib/api';

/**
 * WhatsAppContactButton
 * 
 * Displays WhatsApp contact button for confirmed/accepted bookings.
 * Fetches WhatsApp details and opens wa.me link when clicked.
 * 
 * @param {string} bookingId - The booking ID
 * @param {string} bookingStatus - Current booking status
 * @param {object} contactPerson - Optional: pre-loaded contact info (name, phone)
 */
export function WhatsAppContactButton({ bookingId, bookingStatus, contactPerson }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Only show for confirmed or accepted bookings
  const isEligible = ['confirmed', 'accepted'].includes(bookingStatus);

  if (!isEligible) {
    return null;
  }

  const handleOpenWhatsApp = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await getWhatsAppDetails(bookingId);
      const data = response.data?.data;

      if (data?.whatsappUrl) {
        // Open WhatsApp in new tab
        window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
      } else {
        setError('WhatsApp contact details are not available');
      }
    } catch (err) {
      console.error('Error fetching WhatsApp details:', err);
      const message = err.response?.data?.message || 'Unable to load WhatsApp contact. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleOpenWhatsApp}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20BD5A] hover:to-[#0F7A6B] text-white font-bold text-sm rounded-2xl shadow-lg shadow-[#25D366]/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            <MessageCircle className="w-5 h-5" strokeWidth={2} />
            <span>Open WhatsApp Chat</span>
            <ExternalLink className="w-4 h-4 opacity-70" />
          </>
        )}
      </button>

      {error && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-xs font-semibold text-red-600 text-center">{error}</p>
        </div>
      )}

      {!error && contactPerson?.name && (
        <p className="text-xs text-[#6E7587] text-center leading-relaxed">
          Connect with <span className="font-bold text-[#17233C]">{contactPerson.name}</span> to coordinate pickup details
        </p>
      )}
    </div>
  );
}

/**
 * WhatsAppContactCard
 * 
 * Full card component showing contact info with WhatsApp button.
 * Used in detailed booking views.
 */
export function WhatsAppContactCard({ bookingId, bookingStatus, contactPerson, title }) {
  const isEligible = ['confirmed', 'accepted'].includes(bookingStatus);

  if (!isEligible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-[#FFF7F2] to-white rounded-2xl p-5 border border-[#F4E3D8] shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-black text-[#17233C]">
            {title || 'WhatsApp Coordination'}
          </h3>
          <p className="text-xs text-[#6E7587] mt-0.5">
            Your ride is confirmed
          </p>
        </div>
      </div>

      {/* Contact Info */}
      {contactPerson && (
        <div className="mb-4 px-4 py-3 bg-white rounded-xl border border-[#F4E3D8]">
          <div className="flex items-center gap-3">
            {contactPerson.imageUrl ? (
              <img
                src={contactPerson.imageUrl}
                alt={contactPerson.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#FFE4D3] text-[#FF572E] flex items-center justify-center text-sm font-black">
                {contactPerson.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#17233C] truncate">
                {contactPerson.name || 'Fellow Student'}
              </p>
              {contactPerson.college && (
                <p className="text-xs text-[#6E7587] truncate">
                  {contactPerson.college}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Button */}
      <WhatsAppContactButton
        bookingId={bookingId}
        bookingStatus={bookingStatus}
        contactPerson={contactPerson}
      />

      {/* Privacy Note */}
      <div className="mt-4 flex items-start gap-2 px-3 py-2 bg-[#FFF4ED] border border-[#FDE0D0] rounded-xl">
        <span className="text-xs">🔒</span>
        <p className="text-xs text-[#6E7587] leading-relaxed">
          Contact details are private and only shared between confirmed ride participants.
        </p>
      </div>
    </div>
  );
}
