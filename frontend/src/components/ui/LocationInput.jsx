import { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Check, ChevronDown, Sparkles } from 'lucide-react';

const DEFAULT_POPULAR_LOCATIONS = [
  'VIT, Bhopal',
  'Bhopal Railway Station',
  'Rani Kamlapati Station (RKMP)',
  'Bhopal Airport (BHO)',
  'Indore (Bhawarkua / Bypass)',
  'Lalghati, Bhopal',
  'MP Nagar Zone 1',
  'Sehore Bus Stand',
  'Ashta Toll Plaza',
];

/**
 * Mobile-friendly Location Input with inline suggestions dropdown.
 * Replaces the HTML5 <datalist> tag which renders an awkward floating pill on Android WebViews.
 */
export function LocationInput({
  label,
  value,
  onChange,
  placeholder = 'Enter campus or transit point...',
  dotColor = 'green', // 'green' | 'orange'
  locations = DEFAULT_POPULAR_LOCATIONS,
  required = false,
  id,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Filter locations based on query
  const filteredLocations = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((loc) => loc.toLowerCase().includes(q));
  }, [value, locations]);

  const hasExactMatch = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    return locations.some((loc) => loc.toLowerCase() === q);
  }, [value, locations]);

  const handleSelect = (selectedLoc) => {
    onChange(selectedLoc);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    // Smoothly scroll container into view to prevent keyboard overlap on mobile
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 250);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div 
        className="p-3 pr-11 focus-within:bg-[#FFFBF8] transition-colors cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex items-center gap-1.5 text-[10px] font-black text-[#6E7587] uppercase tracking-wider mb-0.5 select-none">
          <span 
            className={`w-2 h-2 rounded-full shrink-0 ${
              dotColor === 'green' ? 'bg-[#16A34A]' : 'bg-[#FF572E]'
            }`} 
          />
          <span>{label}</span>
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          className="w-full bg-transparent text-xs sm:text-sm font-extrabold text-[#17233C] placeholder:text-[#8C93A4] focus:outline-none"
        />
      </div>

      {/* Custom Floating Suggestion Dropdown (Anchored directly under input) */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-[#F4E3D8] shadow-xl overflow-hidden z-30 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-1.5 space-y-0.5">
            {/* Custom option if typed text isn't in popular presets */}
            {value?.trim() && !hasExactMatch && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(value.trim()); }}
                className="w-full p-2.5 rounded-xl bg-[#FFF9F5] border border-[#FDE3D3] hover:bg-[#FFEBE0] text-left text-xs font-black text-[#FF572E] flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Use custom: "{value.trim()}"</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF572E] shrink-0">Custom</span>
              </button>
            )}

            {filteredLocations.map((loc) => {
              const isSelected = (value || '').trim().toLowerCase() === loc.toLowerCase();
              return (
                <button
                  key={loc}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(loc); }}
                  className={`w-full p-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#FFF2EB] text-[#FF572E] font-extrabold'
                      : 'text-[#17233C] hover:bg-[#FFFBF8] hover:text-[#FF572E]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#FF572E]' : 'text-[#8C93A4]'}`} />
                    <span className="truncate">{loc}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#FF572E] shrink-0 stroke-[2.5]" />}
                </button>
              );
            })}

            {filteredLocations.length === 0 && !value?.trim() && (
              <div className="p-3 text-center text-xs text-[#8C93A4] font-medium">
                No matching locations
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationInput;

