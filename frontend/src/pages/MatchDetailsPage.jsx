import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, Calendar, Users } from 'lucide-react';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { Avatar } from '../components/ui/Avatar';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { formatDate } from '../lib/utils';

export default function MatchDetailsPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const match = state?.match || {
    _id: '1',
    name: 'Priya Singh',
    avatarId: 'f1',
    rating: '4.9',
    college: 'BTech CSE • VIT',
    from: 'VIT',
    to: 'Bhopal',
    departureTime: new Date().toISOString(),
    seats: 2,
    pricePerSeat: 350,
    about: 'Travelling to Bhopal. Serene and friendly. Let\'s travel together! ✨',
    rides: 12,
    mutualRides: 4,
    responseRate: 98,
  };

  return (
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Match Details" backTo={-1} />}
    >
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 lg:py-8 space-y-5">
        {/* Hero avatar with cloud background */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-peach rounded-3xl p-8 flex flex-col items-center text-center"
        >
          <div className="relative mb-3">
            <Avatar avatarId={match.avatarId} size="2xl" />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
          </div>
          <h2 className="font-black text-navy text-xl">{match.name}</h2>
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-navy">{match.rating}</span>
          </div>
          <p className="text-text-secondary text-sm mt-1">{match.college}</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
        >
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[
              { label: 'Rides', value: match.rides || 12 },
              { label: 'Mutual Rides', value: match.mutualRides || 4 },
              { label: 'Response', value: `${match.responseRate || 98}%` },
            ].map((s) => (
              <div key={s.label} className="text-center px-2">
                <div className="font-black text-navy text-xl">{s.value}</div>
                <div className="text-text-secondary text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Route details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3"
        >
          {[
            { icon: <MapPin className="w-4 h-4 text-coral" />, text: `${match.from} → ${match.to}` },
            { icon: <Calendar className="w-4 h-4 text-coral" />, text: formatDate(match.departureTime) },
            { icon: <Users className="w-4 h-4 text-coral" />, text: `${match.seats || 2} Seats` },
            { icon: <span className="text-coral font-bold text-sm">₹</span>, text: `₹${match.pricePerSeat || 350} per seat` },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-navy">
              {row.icon}
              <span>{row.text}</span>
            </div>
          ))}
        </motion.div>

        {/* About */}
        {match.about && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <h3 className="font-bold text-navy mb-2">About {match.name?.split(' ')[0]}</h3>
            <p className="text-text-secondary text-sm leading-relaxed">{match.about}</p>
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <PrimaryButton
            variant="outline"
            onClick={() => navigate(`/chat/${match._id}`)}
            className="flex-1"
            fullWidth={false}
          >
            💬 Message
          </PrimaryButton>
          <PrimaryButton
            variant="coral"
            onClick={() => navigate('/book/match', { state: { travel: match } })}
            className="flex-1"
            fullWidth={false}
          >
            Book Seat
          </PrimaryButton>
        </div>
      </div>
    </ResponsiveShell>
  );
}

