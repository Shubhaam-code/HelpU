import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { RideCard } from '../components/ui/RideCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { getTravels } from '../lib/api';

const TABS = ['All', 'Offers', 'Requests'];
const FILTERS = ['VIT ↔ Bhopal', 'Date', 'Seats'];

export default function RidesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('All');
  const [activeFilter, setActiveFilter] = useState(null);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRides = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab === 'Offers') params.type = 'offer';
      if (activeTab === 'Requests') params.type = 'request';
      const res = await getTravels(params);
      setRides(res.data?.data || res.data?.travels || []);
    } catch (err) {
      console.error('Rides fetch error:', err);
      setRides([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <AppHeader title="Rides" backTo={false} />

      <div className="px-5">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-coral text-white shadow-sm shadow-coral/30'
                  : 'bg-white text-text-secondary border border-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(activeFilter === f ? null : f)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
                activeFilter === f
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-navy border-gray-100'
              }`}
            >
              {f}
              <span className="text-[10px] opacity-60">▾</span>
            </button>
          ))}
        </div>

        {/* Ride list */}
        <AnimatePresence mode="wait">
          {loading ? (
            <LoadingSkeleton count={3} />
          ) : rides.length === 0 ? (
            <EmptyState
              icon="🚗"
              title="No rides found"
              subtitle="Be the first to offer a ride on this route!"
              action={
                <PrimaryButton
                  onClick={() => navigate('/rides/offer')}
                  variant="coral"
                  fullWidth={false}
                  className="px-8"
                >
                  Offer a Ride
                </PrimaryButton>
              }
            />
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              {rides.map((ride) => (
                <RideCard
                  key={ride._id}
                  travel={ride}
                  onPress={() => navigate(`/rides/${ride._id}`)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNavigation />
    </div>
  );
}
