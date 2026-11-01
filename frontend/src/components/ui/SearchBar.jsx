import { Search, QrCode } from 'lucide-react';

export function SearchBar({ placeholder = 'Search rides, people, or places...', value, onChange, onQr }) {
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-4 text-text-secondary w-4 h-4" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full bg-white rounded-2xl py-3.5 pl-11 pr-11 text-sm text-navy placeholder:text-text-secondary shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/30 transition"
      />
      {onQr && (
        <button onClick={onQr} className="absolute right-4 text-text-secondary hover:text-navy">
          <QrCode className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default SearchBar;
