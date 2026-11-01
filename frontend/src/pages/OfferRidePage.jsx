import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Clock, Users, DollarSign } from 'lucide-react';
import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { createTravel } from '../lib/api';

export default function OfferRidePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('offer'); // 'offer' | 'request'
  const [form, setForm] = useState({
    from: 'VIT, Bhopal',
    to: '',
    date: '',
    time: '',
    seats: 3,
    price: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.to || !form.date || !form.time) {
      setError('Please fill all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const departureTime = new Date(`${form.date}T${form.time}`).toISOString();
      await createTravel({
        from: form.from,
        to: form.to,
        departureTime,
        availableSeats: form.seats,
        pricePerSeat: Number(form.price) || 0,
        type: mode,
        timeFlexibility: 30,
      });
      navigate('/rides', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to post ride.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveShell
      customMobileHeader={
        <AppHeader title={mode === 'offer' ? 'Offer a Ride' : 'Request a Ride'} backTo={-1} />
      }
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 lg:py-8 space-y-5">
        <div className="hidden sm:block">
          <h2 className="font-black text-navy text-2xl lg:text-3xl">
            {mode === 'offer' ? 'Offer a Campus Ride' : 'Request a Ride'}
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            {mode === 'offer' 
              ? 'Share empty seats in your car or bike and split travel costs.' 
              : 'Post your destination and get picked up by verified peers.'}
          </p>
        </div>
        {/* Toggle */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
          {['offer', 'request'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${
                mode === m ? 'bg-coral text-white shadow-sm' : 'text-text-secondary'
              }`}
            >
              {m === 'offer' ? 'Offer Ride' : 'Request Ride'}
            </button>
          ))}
        </div>

        {/* From */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">From</label>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-coral/10 rounded-full flex items-center justify-center">
              <MapPin className="w-4 h-4 text-coral" />
            </div>
            <input
              value={form.from}
              onChange={(e) => setForm((p) => ({ ...p, from: e.target.value }))}
              placeholder="VIT, Bhopal"
              className="flex-1 text-navy font-medium text-sm bg-transparent outline-none"
            />
          </div>
        </div>

        {/* To */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">To</label>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-navy/10 rounded-full flex items-center justify-center">
              <MapPin className="w-4 h-4 text-navy" />
            </div>
            <input
              value={form.to}
              onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
              placeholder="Bhopal Railway Station"
              className="flex-1 text-navy font-medium text-sm bg-transparent outline-none"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">Date</label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-navy shrink-0" />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="text-navy font-medium text-sm bg-transparent outline-none w-full"
              />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">Time</label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-navy shrink-0" />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                className="text-navy font-medium text-sm bg-transparent outline-none w-full"
              />
            </div>
          </div>
        </div>

        {/* Seats */}
        {mode === 'offer' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 block">Seats Available</label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-secondary">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium text-navy">{form.seats}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForm((p) => ({ ...p, seats: Math.max(1, p.seats - 1) }))}
                  className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-navy font-bold text-xl hover:border-coral hover:text-coral transition"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold text-navy text-lg">{form.seats}</span>
                <button
                  onClick={() => setForm((p) => ({ ...p, seats: Math.min(8, p.seats + 1) }))}
                  className="w-9 h-9 rounded-full border-2 border-coral bg-coral/5 flex items-center justify-center text-coral font-bold text-xl hover:bg-coral hover:text-white transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Price */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">Price per Seat</label>
          <div className="flex items-center gap-3">
            <span className="text-navy font-bold text-lg">₹</span>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              placeholder="350"
              className="flex-1 text-navy font-medium text-sm bg-transparent outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
        )}

        <PrimaryButton
          variant="navy"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Posting...' : mode === 'offer' ? 'Post Ride →' : 'Post Request →'}
        </PrimaryButton>
      </div>
    </ResponsiveShell>
  );
}

