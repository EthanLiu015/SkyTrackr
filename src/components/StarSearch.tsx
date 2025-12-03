import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface StarSearchProps {
  onSearch: (starName: string) => void;
  availableStars?: string[];
}

export function StarSearch({ onSearch, availableStars = [] }: StarSearchProps) {
  const [searchInput, setSearchInput] = useState('');
  const [filteredStars, setFilteredStars] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (searchInput.trim()) {
      const lowerInput = searchInput.toLowerCase();
      const matches = availableStars.filter(star =>
        star.toLowerCase().includes(lowerInput)
      );
      setFilteredStars(matches);
      setShowDropdown(matches.length > 0);
      setErrorMessage('');
    } else {
      setFilteredStars([]);
      setShowDropdown(false);
      setErrorMessage('');
    }
  }, [searchInput, availableStars]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = searchInput.trim();
    
    if (!trimmedInput) {
      setErrorMessage('Please enter a star name');
      return;
    }

    const found = availableStars.find(
      star => star.toLowerCase() === trimmedInput.toLowerCase()
    );

    if (found) {
      onSearch(trimmedInput);
      setSearchInput('');
      setFilteredStars([]);
      setShowDropdown(false);
      setErrorMessage('');
    } else {
      setErrorMessage(`Star "${trimmedInput}" not found`);
      setShowDropdown(false);
    }
  };

  const handleSelectStar = (star: string) => {
    onSearch(star);
    setSearchInput('');
    setFilteredStars([]);
    setShowDropdown(false);
    setErrorMessage('');
  };

  return (
    <div className="absolute top-4 left-4 z-10">
      <form onSubmit={handleSearch} className="mb-2">
        <div className="relative">
          <div className="flex items-center bg-black bg-opacity-75 border border-blue-500 rounded px-3 py-2">
            <input
              type="text"
              placeholder="Search star..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => searchInput.trim() && setShowDropdown(filteredStars.length > 0)}
              className="bg-transparent text-white placeholder-gray-400 outline-none w-48"
            />
            <button
              type="submit"
              className="ml-2 text-blue-500 hover:text-blue-400 transition-colors"
            >
              <Search size={20} />
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && filteredStars.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-black bg-opacity-90 border border-blue-500 rounded max-h-48 overflow-y-auto">
              {filteredStars.slice(0, 10).map((star, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectStar(star)}
                  className="w-full text-left px-3 py-2 text-white hover:bg-blue-900 hover:bg-opacity-50 transition-colors text-sm"
                >
                  {star}
                </button>
              ))}
              {filteredStars.length > 10 && (
                <div className="px-3 py-2 text-gray-400 text-xs">
                  +{filteredStars.length - 10} more...
                </div>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-900 bg-opacity-75 border border-red-500 rounded px-3 py-2 text-red-200 text-sm">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
