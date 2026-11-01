import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, SlidersHorizontal, MapPin } from 'lucide-react';

import { ResponsiveShell } from '../components/layout/ResponsiveShell';
import { AppHeader } from '../components/layout/AppHeader';
import { RideCard } from '../components/ui/RideCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { getTravels } from '../lib/api';

const TABS = ['All', 'Offers', 'Requests'];
const FILTERS = ['VIT ↔ Bhopal', 'Today & Tomorrow', 'Available Seats'];

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
    <ResponsiveShell
      customMobileHeader={<AppHeader title="Rides" backTo={false} />}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-white rounded-2xl p-1 shadow-xs border border-gray-100">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-coral text-white shadow-xs font-bold'
                      : 'text-text-secondary hover:text-navy'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Post Ride Button on Desktop */}
            <button
              onClick={() => navigate('/rides/offer')}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-navy text-white rounded-2xl text-xs font-bold hover:bg-navy/90 transition-colors shadow-xs cursor-pointer ml-2"
            >
              <Plus className="w-4 h-4 text-coral" />
              <span>Offer a Ride</span>
            </button>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(activeFilter === f ? null : f)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  activeFilter === f
                    ? 'bg-navy text-white border-navy shadow-xs'
                    : 'bg-white text-navy border-gray-100 hover:border-gray-200 shadow-2xs'
                }`}
              >
                <span>{f}</span>
                <span className="text-[10px] opacity-60">▾</span>
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Rides Grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <LoadingSkeleton count={6} />
            </div>
          ) : rides.length === 0 ? (
            <div className="max-w-md mx-auto py-12">
              <EmptyState
                icon="🚗"
                title="No rides found"
                subtitle="Be the first to offer or request a ride on this route!"
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
            </div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
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
    </ResponsiveShell>
  );
}
