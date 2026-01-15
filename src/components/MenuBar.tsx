import { Menu, MapPin } from "lucide-react";
import { Button } from "./ui/button";
import { StarSearch } from "./StarSearch";
import { useLocationName } from "../utils/useLocationName";

interface MenuBarProps {
  onMenuClick: () => void;
  onSearch: (starName: string) => void;
  availableStars: string[];
  currentView: "sky" | "conditions";
}

export function MenuBar({ onMenuClick, onSearch, availableStars, currentView }: MenuBarProps) {
  const locationName = useLocationName();

  return (
    <header className="w-full bg-[#2a2a2a] border-b border-gray-700 px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center">
      <div className="flex items-center gap-4 justify-self-start">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="text-white hover:bg-gray-700"
        >
          <Menu className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white">★</span>
          </div>
          <span className="text-white text-xl tracking-wide">SkyTrackr</span>
        </div>
      </div>

      <div className="justify-self-center">
        <StarSearch onSearch={onSearch} availableStars={availableStars} />
      </div>
      <div className="justify-self-end flex items-center gap-2 text-white/80 px-2">
        <MapPin className="w-4 h-4" />
        <span className="text-sm font-medium tracking-wide uppercase">{locationName}</span>
      </div>
    </header>
  );
}
