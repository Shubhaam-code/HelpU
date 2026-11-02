import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, ExternalLink, ShieldCheck, ArrowLeft, Send } from 'lucide-react';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { openWhatsAppChat, getWhatsAppUrl } from '../lib/whatsapp';

export default function ChatConversationPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [phoneInput, setPhoneInput] = useState(state?.phone || '');
  const [customMsg, setCustomMsg] = useState(
    state?.route 
      ? `Hi! Connected via HelpU regarding the ride (${state.route}). Let's coordinate!` 
      : `Hi! Connecting via HelpU regarding campus travel and assistance.`
  );

  const contactName = state?.name || state?.studentName || '';

  const handleOpenWhatsApp = (e) => {
    e?.preventDefault();
    openWhatsAppChat({
      phone: phoneInput,
      name: contactName,
      message: customMsg,
    });
  };

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="WhatsApp Connect" backTo={-1} />}
    >
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 lg:py-12 space-y-6">
        
        {/* Back Link */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-bold text-navy hover:text-coral transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 text-center relative overflow-hidden"
        >
          {/* WhatsApp Badge / Icon */}
          <div className="w-16 h-16 bg-[#25D366]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💬</span>
          </div>

          <h2 className="text-2xl font-black text-navy tracking-tight">
            Direct WhatsApp Messaging
          </h2>
          <p className="text-text-secondary text-sm mt-2 max-w-md mx-auto leading-relaxed">
            HelpU connects you directly to WhatsApp for real-time, end-to-end encrypted coordination with verified campus peers.
          </p>

          {/* Peer details if available */}
          {contactName && (
            <div className="my-4 p-3 bg-cream/70 rounded-2xl inline-flex items-center gap-2 text-xs font-bold text-navy border border-[#F4E3D8]">
              <span>Connecting with:</span>
              <span className="text-coral">{contactName}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleOpenWhatsApp} className="mt-6 space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-navy mb-1.5">
                Co-Traveller Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="e.g. 9876543210 (leave empty to pick contact in WhatsApp)"
                className="w-full bg-[#FFF7F2] rounded-xl px-4 py-3 text-sm text-navy placeholder:text-gray-400 border border-[#F4E3D8] focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy mb-1.5">
                Prefilled Message
              </label>
              <textarea
                rows={3}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="w-full bg-[#FFF7F2] rounded-xl px-4 py-2.5 text-sm text-navy placeholder:text-gray-400 border border-[#F4E3D8] focus:outline-none focus:border-coral focus:ring-2 focus:ring-coral/20 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#25D366]/20 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in WhatsApp</span>
            </button>
          </form>

          {/* Verified Badge */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-xs text-text-secondary font-medium">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span>Strictly verified campus peers only</span>
          </div>
        </motion.div>

      </div>
    </ResponsiveShell>
  );
}
