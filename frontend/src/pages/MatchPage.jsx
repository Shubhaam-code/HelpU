import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { MatchCard } from '../components/ui/MatchCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { EmptyState } from '../components/ui/EmptyState';

// Discover tab — two campus characters illustration + CTA
function DiscoverTab({ onFindMatch }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-4"
    >
      {/* Two campus characters SVG */}
      <svg viewBox="0 0 300 240" fill="none" className="w-64 mb-6">
        {/* Background sky */}
        <rect width="300" height="240" fill="#FFF9F2" />
        
        {/* Left character — boy */}
        <circle cx="100" cy="95" r="24" fill="#FDBCB4" />
        <ellipse cx="100" cy="80" rx="24" ry="10" fill="#17233C" />
        <ellipse cx="82" cy="88" rx="5" ry="10" fill="#17233C" />
        <ellipse cx="100" cy="128" rx="20" ry="18" fill="#FF654F" />
        <rect x="86" y="118" width="10" height="12" rx="4" fill="#FDBCB4" />
        <circle cx="93" cy="95" r="2.5" fill="#1a1a1a" />
        <circle cx="107" cy="95" r="2.5" fill="#1a1a1a" />
        <path d="M93 103 Q100 108 107 103" stroke="#1a1a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Backpack */}
        <rect x="76" y="118" width="16" height="22" rx="5" fill="#C9F2DE" />
        
        {/* Right character — girl */}
        <circle cx="200" cy="95" r="24" fill="#F1A77D" />
        <ellipse cx="200" cy="80" rx="24" ry="10" fill="#1a1a1a" />
        <ellipse cx="182" cy="86" rx="4" ry="14" fill="#1a1a1a" />
        <ellipse cx="218" cy="86" rx="4" ry="14" fill="#1a1a1a" />
        <ellipse cx="200" cy="128" rx="20" ry="18" fill="#17233C" />
        <rect x="186" y="118" width="10" height="12" rx="4" fill="#F1A77D" />
        <circle cx="193" cy="95" r="2.5" fill="#1a1a1a" />
        <circle cx="207" cy="95" r="2.5" fill="#1a1a1a" />
        <path d="M193 103 Q200 108 207 103" stroke="#1a1a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        
        {/* Connection ring in center */}
        <circle cx="150" cy="110" r="22" stroke="#FF654F" strokeWidth="3" strokeDasharray="8 4" fill="white" opacity="0.9" />
        <text x="140" y="116" fontSize="18">🔗</text>
        
        {/* Stars */}
        <text x="50" y="60" fontSize="16">✨</text>
        <text x="240" y="60" fontSize="16">✨</text>
        <text x="140" y="30" fontSize="20">⭐</text>
      </svg>

      <h2 className="font-black text-navy text-2xl mb-3">Find Your Travel<br />Match ✨</h2>
      <p className="text-text-secondary text-sm mb-6 max-w-xs leading-relaxed">
        Get matched with people travelling on the same route, date and time.
      </p>

      {/* Criteria chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {[
          { icon: '📍', text: 'Same Route' },
          { icon: '🕐', text: 'Similar Time' },
          { icon: '✅', text: 'Verified Users' },
        ].map((c) => (
          <div key={c.text} className="flex items-center gap-1.5 px-3.5 py-2 bg-white rounded-full shadow-sm border border-gray-100 text-xs font-semibold text-navy">
            <span>{c.icon}</span>
            <span>{c.text}</span>
          </div>
        ))}
      </div>

      <PrimaryButton
        variant="coral"
        onClick={onFindMatch}
        fullWidth={false}
        className="px-10"
      >
        Find a Match →
      </PrimaryButton>
    </motion.div>
  );
}

const MOCK_MATCHES = [
  { _id: '1', name: 'Priya Singh', avatarId: 'f1', rating: '4.9', from: 'VIT', to: 'Bhopal', departureTime: new Date().toISOString(), status: 'matched' },
  { _id: '2', name: 'Aman Verma', avatarId: 'm1', rating: '4.8', from: 'VIT', to: 'Indore', departureTime: new Date().toISOString(), status: 'matched' },
  { _id: '3', name: 'Karan Raj', avatarId: 'm4', rating: '4.7', from: 'Bhopal', to: 'VIT', departureTime: new Date().toISOString(), status: 'matched' },
  { _id: '4', name: 'Neha Gupta', avatarId: 'f3', rating: '4.9', from: 'VIT', to: 'Bhopal', departureTime: new Date(Date.now() + 86400000).toISOString(), status: 'pending' },
];

export default function MatchPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Discover');
  const TABS = ['Discover', 'My Matches', 'Requests'];

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <AppHeader title="Match" backTo={false} />

      <div className="px-5">
        {/* Tabs */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab ? 'bg-coral text-white shadow-sm' : 'text-text-secondary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'Discover' && (
            <motion.div key="discover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DiscoverTab onFindMatch={() => navigate('/match/preferences')} />
            </motion.div>
          )}

          {activeTab === 'My Matches' && (
            <motion.div key="matches" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
              {MOCK_MATCHES.map((m) => (
                <MatchCard
                  key={m._id}
                  match={m}
                  onPress={() => navigate(`/match/${m._id}`, { state: { match: m } })}
                  onChat={() => navigate(`/chat/${m._id}`)}
                />
              ))}
            </motion.div>
          )}

          {activeTab === 'Requests' && (
            <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon="📨"
                title="No match requests yet"
                subtitle="When someone wants to match with you, they'll appear here."
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNavigation />
    </div>
  );
}
