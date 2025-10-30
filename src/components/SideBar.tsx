import { Home, Compass, Star, Settings, Info, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

interface SideNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SideNav({ open, onOpenChange }: SideNavProps) {
  const navItems = [
    { icon: Home, label: "Home", href: "#" },
    { icon: Search, label: "Search Sky", href: "#" },
    { icon: Compass, label: "Navigate", href: "#" },
    { icon: Star, label: "Favorites", href: "#" },
    { icon: Settings, label: "Settings", href: "#" },
    { icon: Info, label: "About", href: "#" },
  ];

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
            <a
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
