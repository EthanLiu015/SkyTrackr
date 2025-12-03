import { useState } from "react";
import { MenuBar } from "../components/MenuBar";
import { SideNav } from "../components/SideBar";
import { SkyDisplay, type SkyDisplayHandles } from "../components/SkyDisplay";
import { ConditionsDisplay } from "./ConditionsDisplay";
import { useRef } from "react";

export default function Display() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"sky" | "conditions">("sky");
  const [availableStarNames, setAvailableStarNames] = useState<string[]>([]);
  const skyDisplayRef = useRef<SkyDisplayHandles>(null);

  const handleSearch = (starName: string) => {
    skyDisplayRef.current?.searchForStar(starName);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-black">
      {/* Header containing Menu and Search */}
      <MenuBar 
        onMenuClick={() => setSideBarOpen(true)} 
        onSearch={handleSearch}
        availableStars={currentView === "sky" ? availableStarNames : []}
      />
      
      <main className="flex-1 overflow-y-auto">
        {currentView === "sky" && <SkyDisplay ref={skyDisplayRef} onStarDataLoaded={setAvailableStarNames} />}
        {currentView === "conditions" && <ConditionsDisplay />}
      </main>
      
      <SideNav open={sideBarOpen} onOpenChange={setSideBarOpen} onNavigate={(view) => {
        setCurrentView(view);
        setSideBarOpen(false);
      }} />
    </div>
  );
}