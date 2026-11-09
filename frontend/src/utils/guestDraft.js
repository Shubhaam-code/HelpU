/**
 * Helpu Guest Draft Engine
 *
 * Manages segregated, persistent client-side form drafts for PoolMate,
 * SlotMate, and Booking flows.
 *
 * Rules:
 * 1. Strictly independent storage keys:
 *    - helpu_guest_draft_poolmate
 *    - helpu_guest_draft_slotmate
 *    - helpu_guest_draft_booking
 * 2. 24-hour expiration TTL on all draft types.
 * 3. Expired or corrupted drafts are automatically purged.
 * 4. Starting or saving a draft in one module NEVER alters or overwrites the other.
 * 5. Cleared only upon explicit user submission confirmation or manual reset.
 */

export const DRAFT_KEYS = {
  POOLMATE: 'helpu_guest_draft_poolmate',
  SLOTMATE: 'helpu_guest_draft_slotmate',
  BOOKING:  'helpu_guest_draft_booking',
  PROFILE:  'helpu_guest_draft_profile',
};

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

/**
 * Generate a RFC4122 version 4 UUID for idempotency protection.
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Safely parse and validate a draft item from localStorage.
 */
function readDraft(storageKey) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Check expiration (24h TTL)
    if (draft.expiresAt && Date.now() > draft.expiresAt) {
      localStorage.removeItem(storageKey);
      return null;
    }

    if (!draft.data || typeof draft.data !== 'object') {
      localStorage.removeItem(storageKey);
      return null;
    }

    return draft;
  } catch (err) {
    console.warn(`[GuestDraft] Error reading draft for key ${storageKey}:`, err);
    try { localStorage.removeItem(storageKey); } catch {}
    return null;
  }
}

/**
 * Safely save a draft item to localStorage.
 */
function writeDraft(storageKey, payload) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const now = Date.now();
    const entry = {
      version: 1,
      createdAt: now,
      expiresAt: now + DRAFT_TTL_MS,
      ...payload
    };
    localStorage.setItem(storageKey, JSON.stringify(entry));
    return true;
  } catch (err) {
    console.warn(`[GuestDraft] Failed to write draft for key ${storageKey}:`, err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PoolMate Draft Methods
// ─────────────────────────────────────────────────────────────────────────────

export function savePoolMateDraft(formData, returnPath = '/rides/offer', draftType = 'offer') {
  return writeDraft(DRAFT_KEYS.POOLMATE, {
    domain: 'poolmate',
    draftType,
    returnPath,
    data: formData
  });
}

export function getPoolMateDraft() {
  const item = readDraft(DRAFT_KEYS.POOLMATE);
  if (!item || item.domain !== 'poolmate') return null;
  return item;
}

export function clearPoolMateDraft() {
  try {
    localStorage.removeItem(DRAFT_KEYS.POOLMATE);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotMate Draft Methods
// ─────────────────────────────────────────────────────────────────────────────

export function saveSlotMateDraft(formData, returnPath = '/slotmate/create') {
  return writeDraft(DRAFT_KEYS.SLOTMATE, {
    domain: 'slotmate',
    draftType: 'slot_post',
    returnPath,
    data: formData
  });
}

export function getSlotMateDraft() {
  const item = readDraft(DRAFT_KEYS.SLOTMATE);
  if (!item || item.domain !== 'slotmate') return null;
  return item;
}

export function clearSlotMateDraft() {
  try {
    localStorage.removeItem(DRAFT_KEYS.SLOTMATE);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// General Multi-Draft Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the intended returnPath of the most recently created valid guest draft,
 * or null if no pending draft exists.
 * Covers PoolMate, SlotMate, and Booking drafts.
 */
export function getPendingDraftReturnPath() {
  const poolDraft    = getPoolMateDraft();
  const slotDraft    = getSlotMateDraft();
  const bookingDraft = getBookingDraft();

  const candidates = [poolDraft, slotDraft, bookingDraft].filter(Boolean);
  if (candidates.length === 0) return null;

  // Return the returnPath of the most recently created draft
  const newest = candidates.reduce((a, b) =>
    (a.createdAt || 0) >= (b.createdAt || 0) ? a : b
  );
  return newest.returnPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking Draft Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a passenger booking draft for guest users.
 * travelId – the MongoDB travel document ID of the ride being booked.
 * formData  – { fullName, email, phone, notes, seats }
 * returnPath – URL to navigate back to after auth (defaults to /rides/:id).
 */
export function saveBookingDraft(travelId, formData, returnPath) {
  const rp = returnPath || `/rides/${travelId}`;
  return writeDraft(DRAFT_KEYS.BOOKING, {
    domain: 'booking',
    draftType: 'booking_request',
    returnPath: rp,
    data: { travelId, ...formData }
  });
}

export function getBookingDraft() {
  const item = readDraft(DRAFT_KEYS.BOOKING);
  if (!item || item.domain !== 'booking') return null;
  return item;
}

export function clearBookingDraft() {
  try {
    localStorage.removeItem(DRAFT_KEYS.BOOKING);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Student Profile Draft Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save student profile details entered by a guest user before authentication.
 * formData – { name, registrationNumber, branch, year, phone, whatsappNumber, whatsappCountryCode, college }
 */
export function saveProfileDraft(formData) {
  return writeDraft(DRAFT_KEYS.PROFILE, {
    domain: 'profile',
    draftType: 'student_profile',
    returnPath: '/home',
    data: formData
  });
}

export function getProfileDraft() {
  const item = readDraft(DRAFT_KEYS.PROFILE);
  if (!item || item.domain !== 'profile') return null;
  return item;
}

export function clearProfileDraft() {
  try {
    localStorage.removeItem(DRAFT_KEYS.PROFILE);
  } catch {}
}


