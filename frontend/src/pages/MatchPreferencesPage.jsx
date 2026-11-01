import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Clock, Users, ChevronDown } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { PrimaryButton } from '../components/ui/PrimaryButton';

const TRANSPORT_MODES = ['Car', 'Bike', 'Any'];

export default function MatchPreferencesPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    from: 'VIT, Bhopal',
    to: 'Bhopal Railway Station',
    date: '',
    time: '',
    mode: 'Car',
    maxTravellers: 2,
  });

  const handleFind = () => {
    navigate('/match/success');
  };

  const DropdownField = ({ label, icon: Icon, value, onChange, options }) => (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">{label}</label>
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-coral shrink-0" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-navy font-medium text-sm bg-transparent outline-none appearance-none"
        >
          {options ? options.map(o => <option key={o} value={o}>{o}</option>) : <option value={value}>{value}</option>}
        </select>
        <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-cream pb-28">
      <AppHeader title="Match Preferences" backTo={-1} />

      <div className="px-5 space-y-4">
        <p className="text-text-secondary text-sm">Set your travel preferences to get better matches.</p>

        {/* From */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">From</label>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-coral shrink-0" />
            <input
              value={form.from}
              onChange={(e) => setForm(p => ({ ...p, from: e.target.value }))}
              className="flex-1 text-navy font-medium text-sm bg-transparent outline-none"
            />
            <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
          </div>
        </div>

        {/* To */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">To</label>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-navy shrink-0" />
            <input
              value={form.to}
              onChange={(e) => setForm(p => ({ ...p, to: e.target.value }))}
              className="flex-1 text-navy font-medium text-sm bg-transparent outline-none"
            />
            <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
          </div>
        </div>

        {/* Date */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">Date</label>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-coral shrink-0" />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
              className="flex-1 text-navy font-medium text-sm bg-transparent outline-none"
            />
            <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
          </div>
        </div>

        {/* Time (optional) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">Time (Optional)</label>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-coral shrink-0" />
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm(p => ({ ...p, time: e.target.value }))}
              placeholder="Around 8:00 AM"
              className="flex-1 text-navy font-medium text-sm bg-transparent outline-none"
            />
            <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
          </div>
        </div>

        {/* Preferred Mode */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 block">Preferred Mode</label>
          <div className="flex gap-3">
            {TRANSPORT_MODES.map((m) => (
              <motion.button
                key={m}
                onClick={() => setForm(p => ({ ...p, mode: m }))}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                  form.mode === m ? 'border-coral bg-coral/5' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <span className="text-xl">{m === 'Car' ? '🚗' : m === 'Bike' ? '🏍️' : '🚌'}</span>
                <span className={`text-xs font-semibold ${form.mode === m ? 'text-coral' : 'text-text-secondary'}`}>{m}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Max co-travellers */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2 block">Max. Co-travellers</label>
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-coral shrink-0" />
            <select
              value={form.maxTravellers}
              onChange={(e) => setForm(p => ({ ...p, maxTravellers: Number(e.target.value) }))}
              className="flex-1 text-navy font-medium text-sm bg-transparent outline-none"
            >
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
          </div>
        </div>

        <PrimaryButton variant="coral" onClick={handleFind}>
          Find Matches
        </PrimaryButton>
      </div>

      <BottomNavigation />
    </div>
  );
}
