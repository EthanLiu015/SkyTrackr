import { Home, Compass, Star, Settings, Info, Search, Cloud } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

interface SideNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (view: "sky" | "conditions") => void;
}

export function SideNav({ open, onOpenChange, onNavigate }: SideNavProps) {
  const navItems = [
    { icon: Home, label: "Home", view: "sky" as const },
    { icon: Search, label: "Search Sky", view: "sky" as const },
    { icon: Compass, label: "Navigate", view: "sky" as const },
    { icon: Star, label: "Favorites", view: "sky" as const },
    { icon: Cloud, label: "Conditions", view: "conditions" as const },
    { icon: Settings, label: "Settings", view: "sky" as const },
    { icon: Info, label: "About", view: "sky" as const },
  ];

  const handleNavClick = (view: "sky" | "conditions") => {
    onNavigate?.(view);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] bg-[#1a1a1a] border-gray-700">
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white">★</span>
            </div>
            <span>SkyTrackr</span>
          </SheetTitle>
        </SheetHeader>
        
        <nav className="mt-8 flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.view)}
              className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors text-left w-full"
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
