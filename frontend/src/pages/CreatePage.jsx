import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';

const OPTIONS = [
  { icon: '🚗', title: 'Offer a Ride', subtitle: 'Share your journey & earn', color: 'bg-peach hover:bg-peach/90', path: '/rides/offer' },
  { icon: '📍', title: 'Request a Ride', subtitle: 'Find someone going your way', color: 'bg-lavender hover:bg-lavender/90', path: '/rides/request' },
  { icon: '🤝', title: 'Find a Match', subtitle: 'Get matched with co-travellers', color: 'bg-mint hover:bg-mint/90', path: '/match' },
  { icon: '🔧', title: 'Request Help', subtitle: 'Get campus peer assistance', color: 'bg-sky hover:bg-sky/90', path: '/help' },
];

export default function CreatePage() {
  const navigate = useNavigate();

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Create" backTo={-1} />}
    >
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 lg:py-8 space-y-4">
        <div className="hidden sm:block mb-4">
          <h2 className="font-black text-navy text-2xl lg:text-3xl">Create New Campus Activity</h2>
          <p className="text-text-secondary text-sm mt-1">What would you like to initiate today?</p>
        </div>

        {OPTIONS.map((opt, i) => (
          <motion.button
            key={opt.path}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(opt.path)}
            className={`w-full flex items-center gap-4 ${opt.color} rounded-3xl p-5 sm:p-6 text-left shadow-xs transition-transform cursor-pointer border border-black/5`}
          >
            <span className="text-4xl sm:text-5xl shrink-0">{opt.icon}</span>
            <div>
              <div className="font-extrabold text-navy text-base sm:text-lg">{opt.title}</div>
              <div className="text-text-secondary text-xs sm:text-sm mt-0.5">{opt.subtitle}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </ResponsiveShell>
  );
}
