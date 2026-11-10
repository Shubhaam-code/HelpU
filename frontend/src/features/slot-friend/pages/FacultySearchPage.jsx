import { useState, useEffect, useRef, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  AlertCircle,
  Loader2,
  GraduationCap,
  Sparkles,
  BookOpen
} from 'lucide-react';

import { SlotMateBottomNav } from '../components/SlotMateBottomNav';
import { FacultyCard } from '../components/FacultyCard';
import { searchFaculty } from '../../../lib/api';
import { useUserProfile } from '../../../hooks/useAppData';
import { useScrollRestoration } from '../../../hooks/useScrollRestoration';

export default function FacultySearchPage() {
  const navigate = useNavigate();
  const { data: profile } = useUserProfile();
  useScrollRestoration();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [facultyList, setFacultyList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [, startTransition] = useTransition();

  const debounceTimerRef = useRef(null);
  const latestReqIdRef = useRef(0);

  // 1. Debounce user search input by ~250ms
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      startTransition(() => {
        setDebouncedQuery(val.trim());
      });
    }, 250);
  };

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    setFacultyList([]);
    setIsSearching(false);
    setError(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  // 2. Fetch faculty list ONLY when debounced query has at least 2 characters
  useEffect(() => {
    const reqId = ++latestReqIdRef.current;
    setError(null);

    // If query is empty or less than 2 chars, do not show any default teachers
    if (debouncedQuery.length < 2) {
      setFacultyList([]);
      setIsSearching(false);
      return;
    }

    const fetchData = async () => {
      try {
        setIsSearching(true);
        const res = await searchFaculty(debouncedQuery, 20);
        if (reqId === latestReqIdRef.current) {
          setFacultyList(res?.data?.data || []);
          setIsSearching(false);
        }
      } catch (err) {
        if (reqId === latestReqIdRef.current) {
          console.error('[FacultySearch] Error searching faculty:', err);
          setError('Unable to load faculty search results. Please check your connection.');
          setIsSearching(false);
        }
      }
    };

    fetchData();

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [debouncedQuery]);

  const handleSelectFaculty = (faculty) => {
    const id = faculty.facultyId || faculty._id;
    navigate(`/slotmate/faculty/${encodeURIComponent(id)}`);
  };

  const isQueryTooShort = query.length > 0 && query.trim().length < 2;
  const isSearchActive = debouncedQuery.length >= 2;

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col justify-between">
      {/* Main Scrollable Container */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-28">
        {/* Enhanced Hero Banner Section - Golden pill removed per feedback */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFFDF9] via-[#FEFCE8]/50 to-[#FFF7ED] border border-[#F4E3D8] p-5 sm:p-6 shadow-[0_4px_24px_rgba(23,35,60,0.03)] min-h-[145px] sm:min-h-[160px] flex items-center">
          <div className="relative z-10 max-w-[56%] sm:max-w-[60%]">
            <h1 className="text-2.5xl sm:text-3xl font-extrabold text-[#17233C] tracking-tight leading-tight">
              Faculty
            </h1>
            <p className="text-xs sm:text-sm text-[#4B5563] font-medium mt-1.5 leading-relaxed">
              Search faculty, read student reviews and make better slot choices.
            </p>
          </div>

          {/* 3D Hero Illustration */}
          <img
            src="/faculty-hero-3d.png"
            alt="Faculty Illustration"
            className="absolute -bottom-3 -right-3 w-44 sm:w-56 h-auto object-contain pointer-events-none drop-shadow-md select-none"
            loading="eager"
          />
        </section>

        {/* Search Input Section */}
        <div className="mt-4 relative">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-[#9CA3AF] pointer-events-none stroke-[2.2]" />
            <input
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Search faculty by name..."
              aria-label="Search faculty by name"
              autoComplete="off"
              className="w-full pl-11 pr-11 py-3.5 bg-white rounded-full border border-[#F4E3D8] text-[15px] font-medium text-[#17233C] placeholder-[#9CA3AF] shadow-[0_2px_12px_rgba(23,35,60,0.03)] focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FEF08A]/60 transition-all"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search query"
                className="absolute right-3.5 p-1 rounded-full hover:bg-gray-100 text-[#9CA3AF] hover:text-[#17233C] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-10">
                <Loader2 className="w-4 h-4 animate-spin text-[#EA580C]" />
              </div>
            )}
          </div>

          {/* 1-character hint */}
          {isQueryTooShort && (
            <p className="text-xs text-[#9CA3AF] font-medium mt-1.5 ml-4">
              Type at least 2 characters to search...
            </p>
          )}
        </div>

        {/* Dynamic Content Stream */}
        {isSearchActive && (
          <div className="flex items-center justify-between mt-5 mb-3 px-1">
            <h2 className="text-sm font-black text-[#17233C] tracking-tight">
              Results for "{debouncedQuery}"
            </h2>
            {!isSearching && facultyList.length > 0 && (
              <span className="text-xs font-bold text-[#6E7587] bg-[#F4E3D8]/50 px-2.5 py-0.5 rounded-full">
                {facultyList.length} {facultyList.length === 1 ? 'result' : 'results'}
              </span>
            )}
          </div>
        )}

        {/* Results / Empty / Search Prompt States */}
        {isSearching ? (
          /* Loading Skeletons */
          <div className="space-y-2.5 mt-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#F4E3D8] p-3.5 animate-pulse flex items-center justify-between gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-[#F4E3D8]/50 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F4E3D8]/60 rounded-md w-3/5" />
                  <div className="h-3 bg-[#F4E3D8]/40 rounded-md w-2/5" />
                </div>
                <div className="h-7 bg-[#F4E3D8]/50 rounded-full w-20 shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-red-50/70 border border-red-200 rounded-2xl p-6 text-center mt-4">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-red-800">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                if (debouncedQuery.length >= 2) {
                  setIsSearching(true);
                  searchFaculty(debouncedQuery, 20)
                    .then((r) => setFacultyList(r?.data?.data || []))
                    .catch(() => setError('Could not reload.'))
                    .finally(() => setIsSearching(false));
                }
              }}
              className="mt-3 px-4 py-1.5 rounded-full bg-red-600 text-white font-bold text-xs hover:bg-red-700 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : isSearchActive && facultyList.length === 0 ? (
          /* Search with 0 results found */
          <div className="bg-white rounded-2xl border border-[#F4E3D8] p-8 text-center mt-3 shadow-[0_2px_12px_rgba(23,35,60,0.02)]">
            <div className="w-13 h-13 mx-auto rounded-full bg-[#FEF9C3] flex items-center justify-center mb-3 border border-[#FEF08A]">
              <GraduationCap className="w-6 h-6 text-[#EA580C]" />
            </div>
            <h3 className="text-base font-bold text-[#17233C]">
              No faculty found matching "{debouncedQuery}"
            </h3>
            <p className="text-xs text-[#6E7587] font-medium mt-1 max-w-xs mx-auto leading-relaxed">
              Try searching with a different spelling, first name, or last name.
            </p>
          </div>
        ) : isSearchActive && facultyList.length > 0 ? (
          /* Search Results */
          <div className="space-y-2.5">
            {facultyList.map((faculty) => (
              <FacultyCard
                key={faculty.facultyId || faculty._id}
                faculty={faculty}
                onViewReviews={handleSelectFaculty}
              />
            ))}
          </div>
        ) : (
          /* Default state when NO search query is entered (No teachers shown by default) */
          <div className="bg-white/70 rounded-3xl border border-[#F4E3D8]/80 p-8 text-center mt-5 shadow-[0_2px_16px_rgba(23,35,60,0.02)]">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A]/60 flex items-center justify-center mb-3.5 border border-[#FEF08A] shadow-2xs">
              <Search className="w-6 h-6 text-[#EA580C] stroke-[2.4]" />
            </div>
            <h3 className="text-base font-extrabold text-[#17233C]">
              Search for Faculty
            </h3>
            <p className="text-xs sm:text-[13px] text-[#6E7587] font-medium mt-1.5 max-w-xs mx-auto leading-relaxed">
              Type a professor's name above to check student ratings, internal marking, and reviews.
            </p>
          </div>
        )}
      </main>

      {/* 3. SlotMate Bottom Navigation */}
      <SlotMateBottomNav active="faculty" />
    </div>
  );
}
