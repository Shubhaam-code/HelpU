import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, MessageCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

export function SmartMatchWidget() {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-navy text-base flex items-center gap-1.5">
          <span>Smart Match</span>
          <span className="text-orange-500">🔥</span>
        </h3>
        <button 
          onClick={() => navigate('/match')}
          className="text-xs font-bold text-coral hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View Matches</span>
          <span>→</span>
        </button>
      </div>

      {/* Linked Avatars */}
      <div className="flex flex-col items-center text-center my-auto py-2">
        <div className="flex items-center justify-center gap-3 relative mb-3">
          <Avatar avatarId="m1" size="lg" ring />
          
          {/* Animated Connecting Link */}
          <div className="w-8 h-8 rounded-full bg-coral/90 text-white flex items-center justify-center shadow-md shadow-coral/30 z-10 -mx-1">
            <span className="text-sm">🔗</span>
          </div>

          <Avatar avatarId="f1" size="lg" ring />
        </div>

        <h4 className="font-extrabold text-navy text-lg leading-snug">
          It's a Match! 🎉
        </h4>
        <p className="text-text-secondary text-xs mt-1 max-w-[260px]">
          You and Priya are going to Bhopal this weekend.
        </p>

        {/* Travel Info Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-[11px] font-semibold text-navy">
          <span className="flex items-center gap-1 bg-cream px-2.5 py-1 rounded-full border border-gray-100">
            <MapPin className="w-3 h-3 text-coral" />
            <span>VIT → Bhopal</span>
          </span>
          <span className="flex items-center gap-1 bg-cream px-2.5 py-1 rounded-full border border-gray-100">
            <Calendar className="w-3 h-3 text-coral" />
            <span>Sun, 2 Nov • 8:00 AM</span>
          </span>
          <span className="flex items-center gap-1 bg-cream px-2.5 py-1 rounded-full border border-gray-100">
            <Users className="w-3 h-3 text-coral" />
            <span>2 seats</span>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full mt-4">
          <button
            onClick={() => navigate('/match/1')}
            className="flex-1 py-2.5 px-4 bg-coral text-white rounded-2xl text-xs font-bold hover:bg-coral/90 transition-colors shadow-sm cursor-pointer"
          >
            View Match
          </button>
          <button
            onClick={() => navigate('/chat/1')}
            className="flex-1 py-2.5 px-4 bg-white border border-gray-200 text-navy rounded-2xl text-xs font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5 text-coral" />
            <span>Chat</span>
          </button>
        </div>

        {/* Carousel Indicator Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <span className="w-3 h-1.5 bg-coral rounded-full" />
          <span className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
          <span className="w-1.5 h-1.5 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default SmartMatchWidget;

