import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Avatar } from '../components/ui/Avatar';

// Confetti particles
const CONFETTI = ['🎊', '🎉', '✨', '⭐', '🎈', '🎊', '✨', '🎉'];

export default function MatchSuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-navy flex flex-col items-center justify-center px-8 text-white relative overflow-hidden">
      {/* Confetti */}
      {CONFETTI.map((emoji, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -50, x: Math.random() * 300 - 150, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, 80, 160, 240],
            rotate: Math.random() * 360,
          }}
          transition={{
            delay: i * 0.15,
            duration: 2,
            repeat: Infinity,
            repeatDelay: 3,
          }}
          className="absolute top-0 text-2xl pointer-events-none"
          style={{ left: `${10 + (i * 11)}%` }}
        >
          {emoji}
        </motion.div>
      ))}

      {/* Checkmark at top */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className="w-14 h-14 bg-coral rounded-full flex items-center justify-center mb-8 shadow-lg shadow-coral/40"
      >
        <span className="text-2xl">✓</span>
      </motion.div>

      {/* Avatar pair */}
      <div className="flex items-center gap-4 mb-8">
        <motion.div
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <Avatar avatarId="m1" size="2xl" ring />
        </motion.div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="bg-white/20 rounded-full p-2"
        >
          <span className="text-2xl">🔗</span>
        </motion.div>

        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <Avatar avatarId="f1" size="2xl" ring />
        </motion.div>
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center mb-4"
      >
        <h1 className="font-black text-3xl mb-2">It's a Match! 🎉</h1>
        <p className="text-white/70 text-sm leading-relaxed">
          You and Priya are going to<br />Bhopal on the same date and time.
        </p>
      </motion.div>

      {/* Route info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white/10 rounded-2xl p-4 mb-8 w-full max-w-xs space-y-2"
      >
        <div className="flex items-center gap-2 text-sm text-white/80">
          <span>📍</span>
          <span>VIT → Bhopal</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80">
          <span>📅</span>
          <span>Sun, 2 Nov • 8:00 AM</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80">
          <span>💺</span>
          <span>₹350 per seat</span>
        </div>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="w-full max-w-xs space-y-3"
      >
        <PrimaryButton variant="coral" onClick={() => navigate('/match')}>
          View Match Details
        </PrimaryButton>
        <PrimaryButton variant="ghost" onClick={() => navigate('/chat/1')}>
          💬  Send a Message
        </PrimaryButton>
      </motion.div>
    </div>
  );
}
