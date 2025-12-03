import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface StarSearchProps {
  onSearch: (starName: string) => void;
  availableStars: string[];
}

export function StarSearch({ onSearch, availableStars }: StarSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown if user clicks outside
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length > 0) {
      const filteredSuggestions = availableStars
        .filter(star => star.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 10); // Limit to 10 suggestions
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (starName: string) => {
    setQuery(starName);
    setSuggestions([]);
    onSearch(starName);
    setIsFocused(false); // Hide dropdown after selection
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.length > 0) {
      onSearch(query);
      setSuggestions([]);
      setIsFocused(false);
    }
  };

  return (
    <div className="relative w-80" ref={searchContainerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          placeholder="Search for a star..."
          className="w-full pl-10 pr-4 py-2 text-white bg-gray-800 border border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {isFocused && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 overflow-y-auto bg-gray-900 border border-gray-600 rounded-md max-h-64 shadow-lg">
          {suggestions.map(star => (
            <li
              key={star}
              onClick={() => handleSuggestionClick(star)}
              className="px-4 py-2 text-white cursor-pointer hover:bg-gray-700 transition-colors"
            >
              {star}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}