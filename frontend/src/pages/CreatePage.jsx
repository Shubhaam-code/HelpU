import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Users, Wrench, X } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';

const OPTIONS = [
  { icon: '🚗', title: 'Offer a Ride', subtitle: 'Share your journey & earn', color: 'bg-peach', path: '/rides/offer' },
  { icon: '📍', title: 'Request a Ride', subtitle: 'Find someone going your way', color: 'bg-lavender', path: '/rides/request' },
  { icon: '🤝', title: 'Find a Match', subtitle: 'Get matched with co-travellers', color: 'bg-mint', path: '/match/preferences' },
  { icon: '🔧', title: 'Request Help', subtitle: 'Get campus assistance', color: 'bg-sky', path: '/help' },
];

export default function CreatePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <AppHeader title="Create" backTo={-1} />

      <div className="px-5 space-y-4">
        <p className="text-text-secondary text-sm mb-2">What would you like to do?</p>

        {OPTIONS.map((opt, i) => (
          <motion.button
            key={opt.path}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(opt.path)}
            className={`w-full flex items-center gap-4 ${opt.color} rounded-2xl p-5 text-left`}
          >
            <span className="text-4xl">{opt.icon}</span>
            <div>
              <div className="font-bold text-navy text-base">{opt.title}</div>
              <div className="text-text-secondary text-sm">{opt.subtitle}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
