import { useState } from "react";
import { MenuBar } from "../components/MenuBar";
import { SideNav } from "../components/SideBar";
import { SkyDisplay } from "../components/SkyDisplay";
import { ConditionsDisplay } from "./ConditionsDisplay";

export default function Display() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<"sky" | "conditions">("sky");

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-black">
      <MenuBar onMenuClick={() => setSideBarOpen(true)} />
      
      <main className="flex-1 overflow-y-auto">
        {currentView === "sky" && <SkyDisplay />}
        {currentView === "conditions" && <ConditionsDisplay />}
      </main>
      
      <SideNav open={sideBarOpen} onOpenChange={setSideBarOpen} onNavigate={(view) => {
        setCurrentView(view);
        setSideBarOpen(false);
      }} />
    </div>
  );
}