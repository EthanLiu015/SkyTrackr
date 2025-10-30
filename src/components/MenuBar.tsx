import { Menu } from "lucide-react";
import { Button } from "./ui/button";

interface MenuBarProps {
  onMenuClick: () => void;
}

export function MenuBar({ onMenuClick }: MenuBarProps) {
  return (
    <header className="w-full bg-[#2a2a2a] border-b border-gray-700 px-4 py-3 flex items-center justify-between">
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
    </header>
  );
}
