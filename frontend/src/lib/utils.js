// Utility helpers

/**
 * Format a date string to readable form.
 * e.g. "2024-11-02T08:00:00Z" → "Sun, 2 Nov • 8:00 AM"
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) + ' • ' + d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

/**
 * Format departure minutes from midnight (0..1439) into 12-hour AM/PM format (e.g. 08:30 AM)
 */
export function formatMinutesToTime(minutes) {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '08:00 AM';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const cn = (...classes) => classes.filter(Boolean).join(' ');

export const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

/**
 * Converts any Date, ISO string, or YYYY-MM-DD string to canonical 'YYYY-MM-DD'
 * in local timezone.
 */
export function toCanonicalDateString(d) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d;
  }
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Gets today's date in local 'YYYY-MM-DD' format
 */
export function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Categorizes confirmed rides into Upcoming and Completed history based on travel date.
 */
export function categorizeConfirmedRides(rides = []) {
  const todayStr = getTodayDateString();

  const upcoming = [];
  const completed = [];

  for (const r of rides) {
    if (!['confirmed', 'completed'].includes(r.status)) continue;

    const travel = typeof r.travelId === 'object' ? r.travelId : null;
    const travelDateRaw = travel?.travelDate || r.travelDate;
    const travelDateStr = toCanonicalDateString(travelDateRaw);

    if (!travelDateStr) continue;

    if (travelDateStr >= todayStr && r.status !== 'completed') {
      upcoming.push({ ...r, travelDateStr });
    } else {
      completed.push({ ...r, travelDateStr });
    }
  }

  // Nearest travel date first (ascending), secondary departureTime ascending
  upcoming.sort((a, b) => {
    if (a.travelDateStr !== b.travelDateStr) {
      return a.travelDateStr.localeCompare(b.travelDateStr);
    }
    const tA = (typeof a.travelId === 'object' ? a.travelId?.departureTime : null) ?? 0;
    const tB = (typeof b.travelId === 'object' ? b.travelId?.departureTime : null) ?? 0;
    return tA - tB;
  });

  // Newest completed first (descending travel date), secondary departureTime descending
  completed.sort((a, b) => {
    if (a.travelDateStr !== b.travelDateStr) {
      return b.travelDateStr.localeCompare(a.travelDateStr);
    }
    const tA = (typeof a.travelId === 'object' ? a.travelId?.departureTime : null) ?? 0;
    const tB = (typeof b.travelId === 'object' ? b.travelId?.departureTime : null) ?? 0;
    return tB - tA;
  });

  return { upcoming, completed };
}

