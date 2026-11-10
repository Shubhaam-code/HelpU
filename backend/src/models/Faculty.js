import mongoose from 'mongoose';

// Embedded review sub-document schema
const reviewSchema = new mongoose.Schema(
  {
    text: { type: String, default: '' },
    rating: { type: Number, default: null },
    date: { type: Date, default: null }
  },
  { _id: false }
);

const facultySchema = new mongoose.Schema(
  {
    // --- Primary identifier from CSV (e.g. VITB-0001) ---
    facultyId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },

    // --- Display name as scraped ---
    name: {
      type: String,
      required: true,
      trim: true
    },

    // --- Lowercase, punctuation-stripped for fast prefix search ---
    normalizedName: {
      type: String,
      required: true,
      trim: true
      // index defined via facultySchema.index() below
    },

    // --- Profile fields (empty in current CSV, reserved for future imports) ---
    department: { type: String, default: '', trim: true },
    designation: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    profileUrl: { type: String, default: '', trim: true },

    // --- Per-category ratings (1-5 scale) ---
    teaching_rating: { type: Number, default: null },
    evaluation_rating: { type: Number, default: null },
    behaviour_rating: { type: Number, default: null },
    internals_rating: { type: Number, default: null },
    overall_rating: { type: Number, default: null },

    // --- Aggregated metadata ---
    classAverage: { type: String, default: null, trim: true },   // High / Medium / Low / etc.
    finalRemark: { type: String, default: null, trim: true },   // Highly Recommended / ...
    totalReviews: { type: Number, default: 0 },

    // --- Embedded reviews (suitable since dataset has 1 review/faculty) ---
    reviews: { type: [reviewSchema], default: [] },

    // --- Data provenance ---
    source: { type: String, default: '', trim: true },
    collectedAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true, index: true }
  },
  {
    timestamps: true
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────
// Compound text index for full-text fallback search
facultySchema.index({ name: 'text', department: 'text' });

// Sort-by-rating for top-faculty queries
facultySchema.index({ overall_rating: -1 });

// ─── Helpers ───────────────────────────────────────────────────────────────
/**
 * Normalize a faculty name for indexed prefix search.
 * - Lowercase
 * - Remove leading "Dr.", "Prof.", "Mr.", "Mrs.", "Ms." honorifics
 * - Collapse extra whitespace
 * - Remove punctuation except spaces
 */
export function normalizeFacultyName(name = '') {
  return name
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms)\.\s*/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const Faculty = mongoose.models.Faculty || mongoose.model('Faculty', facultySchema);

export default Faculty;
