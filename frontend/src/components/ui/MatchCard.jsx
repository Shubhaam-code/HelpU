import { motion } from 'framer-motion';
import { Star, MessageCircle, Calendar } from 'lucide-react';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../../lib/utils';

export function MatchCard({ match, onPress, onChat }) {
  return (
    <motion.div
      onClick={onPress}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <Avatar avatarId={match?.avatarId || 'f1'} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-navy text-sm">{match?.name || 'Priya Singh'}</div>
              <div className="flex items-center gap-1 text-xs text-text-secondary">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>{match?.rating || '4.9'}</span>
              </div>
            </div>
            <StatusBadge status={match?.status === 'matched' ? 'matched' : 'pending'} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="truncate">{match?.from || 'VIT'} → {match?.to || 'Bhopal'}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-text-secondary mt-1">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(match?.departureTime)}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onChat?.(); }}
          className="text-coral hover:text-coral/80 transition-colors p-1 flex-shrink-0"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

export default MatchCard;
