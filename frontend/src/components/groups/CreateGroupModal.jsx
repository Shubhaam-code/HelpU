import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CarTaxiFront,
  Users,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Info,
  AlertCircle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { createSharedRideGroup } from '../../lib/api';
import { invalidateGroupQueries } from '../../lib/queryClient';
import { formatMinutesToTime } from '../../lib/utils';

function formatTravelDate(dateStr) {
  if (!dateStr) return 'Upcoming Date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Upcoming Date';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

export function CreateGroupModal({ isOpen, onClose, userTravels = [] }) {
  const navigate = useNavigate();

  // Filter for only eligible, active, unexpired FIND posts (type === 'request')
  const eligibleFindPosts = useMemo(() => {
    const now = new Date();
    return (userTravels || []).filter((t) => {
      const isFind = t.type === 'request';
      const isActive = t.status === 'active';
      const isUnexpired = !t.expiresAt || new Date(t.expiresAt) > now;
      return isFind && isActive && isUnexpired;
    });
  }, [userTravels]);

  const [selectedTravelId, setSelectedTravelId] = useState(() => eligibleFindPosts[0]?._id || '');
  const [targetCapacity, setTargetCapacity] = useState('');
  const [actualCabCapacity, setActualCabCapacity] = useState('');
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Keep selected travel synchronized if default changes
  React.useEffect(() => {
    if (!selectedTravelId && eligibleFindPosts.length > 0) {
      setSelectedTravelId(eligibleFindPosts[0]._id);
    }
  }, [eligibleFindPosts, selectedTravelId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedTravelId) {
      setErrorMsg('Please select an active FIND ride post to create your group from.');
      return;
    }

    const parsedTarget = Number(targetCapacity);
    if (!targetCapacity || isNaN(parsedTarget) || !Number.isInteger(parsedTarget) || parsedTarget < 1) {
      setErrorMsg('Target capacity is required and must be a positive integer (e.g. 3, 4, 6).');
      return;
    }

    let parsedCabCap = undefined;
    if (actualCabCapacity !== '') {
      const parsed = Number(actualCabCapacity);
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        setErrorMsg('Actual cab capacity must be a positive integer if provided.');
        return;
      }
      parsedCabCap = parsed;
    }

    if (whatsappGroupUrl.trim()) {
      const isValidWhatsapp = /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/[a-zA-Z0-9_\-]+$/i.test(
        whatsappGroupUrl.trim()
      );
      if (!isValidWhatsapp) {
        setErrorMsg('Please enter a valid WhatsApp invite link (e.g. https://chat.whatsapp.com/...).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        originatingTravelId: selectedTravelId,
        targetCapacity: parsedTarget,
        ...(parsedCabCap ? { actualCabCapacity: parsedCabCap } : {}),
        ...(whatsappGroupUrl.trim() ? { whatsappGroupUrl: whatsappGroupUrl.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {})
      };

      const res = await createSharedRideGroup(payload);
      const createdGroup = res.data?.data;
      invalidateGroupQueries();
      onClose();

      if (createdGroup?._id) {
        navigate(`/groups/${createdGroup._id}`);
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to create shared ride group.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-2xl p-5 sm:p-7 max-w-lg w-full relative my-auto max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center shadow-2xs font-bold shrink-0">
              <CarTaxiFront className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg sm:text-xl text-[#17233C] tracking-tight">
                Create Shared Ride Group
              </h2>
              <p className="text-xs text-[#6E7587] font-medium">
                Become Group Admin & invite campus peers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto pt-4 space-y-4.5 flex-1 pr-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. SELECT FIND POST */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#17233C] mb-1.5">
              Select Your FIND Post <span className="text-[#FF572E]">*</span>
            </label>

            {eligibleFindPosts.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={selectedTravelId}
                  onChange={(e) => setSelectedTravelId(e.target.value)}
                  className="w-full text-xs sm:text-sm font-bold bg-[#FFFDFB] text-[#17233C] border border-[#F4E3D8] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FF572E]/40 cursor-pointer"
                >
                  {eligibleFindPosts.map((post) => (
                    <option key={post._id} value={post._id}>
                      {post.source} → {post.destination} ({formatTravelDate(post.travelDate)} •{' '}
                      {formatMinutesToTime(post.departureTime)})
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-[#6E7587]">
                  Only your active FIND (request) posts can be used to initiate a group. OFFER posts are strictly excluded.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>No active FIND post found</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  You need an active FIND post before creating a group. Create a post first, then return here to start your group.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/rides/request');
                  }}
                  className="px-3.5 py-1.5 bg-[#FF572E] text-white text-xs font-bold rounded-xl shadow-2xs hover:bg-[#E64A22] transition-colors cursor-pointer"
                >
                  Create a FIND Post Now
                </button>
              </div>
            )}
          </div>

          {/* 2. TARGET CAPACITY */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#17233C] mb-1">
              Target Capacity (Passengers) <span className="text-[#FF572E]">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={targetCapacity}
              onChange={(e) => setTargetCapacity(e.target.value)}
              placeholder="e.g. 4"
              className="w-full text-xs sm:text-sm font-bold bg-[#FFFDFB] text-[#17233C] border border-[#F4E3D8] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FF572E]/40"
              required
            />
            <p className="text-[11px] text-[#6E7587] mt-1">
              Planned total number of student passengers to travel together (excluding the driver). Once this number is reached, the group status automatically transitions to full.
            </p>
          </div>

          {/* 3. OPTIONAL ACTUAL CAB CAPACITY */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#17233C] mb-1">
              Actual Cab Capacity <span className="text-[#6E7587] text-[10px] font-semibold">(Optional)</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={actualCabCapacity}
              onChange={(e) => setActualCabCapacity(e.target.value)}
              placeholder="e.g. 4 or 6 seater vehicle"
              className="w-full text-xs sm:text-sm font-bold bg-[#FFFDFB] text-[#17233C] border border-[#F4E3D8] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FF572E]/40"
            />
            <p className="text-[11px] text-[#6E7587] mt-1">
              Physical seating capacity of the cab if already known. Kept separate from target group size and does not restrict membership.
            </p>
          </div>

          {/* 4. OPTIONAL WHATSAPP INVITE LINK */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#17233C] mb-1">
              WhatsApp Group Invite Link <span className="text-[#6E7587] text-[10px] font-semibold">(Optional)</span>
            </label>
            <input
              type="url"
              value={whatsappGroupUrl}
              onChange={(e) => setWhatsappGroupUrl(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="w-full text-xs sm:text-sm font-bold bg-[#FFFDFB] text-[#17233C] border border-[#F4E3D8] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#FF572E]/40"
            />
            <p className="text-[11px] text-[#6E7587] mt-1">
              Protected: Only confirmed group members will be able to see and use this WhatsApp group link.
            </p>
          </div>

          {/* 5. OPTIONAL COORDINATION NOTES */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#17233C] mb-1">
              Coordination Notes <span className="text-[#6E7587] text-[10px] font-semibold">(Optional)</span>
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Planning to book an Uber XL from Campus Main Gate at 8:30 AM sharp."
              className="w-full text-xs sm:text-sm font-medium bg-[#FFFDFB] text-[#17233C] border border-[#F4E3D8] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#FF572E]/40 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100 shrink-0">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#17233C] text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || eligibleFindPosts.length === 0}
              className={`px-5 py-2.5 bg-[#FF572E] hover:bg-[#E64A22] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                isSubmitting || eligibleFindPosts.length === 0 ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Group...</span>
                </>
              ) : (
                <>
                  <CarTaxiFront className="w-4 h-4" />
                  <span>Create Shared Group</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default CreateGroupModal;

