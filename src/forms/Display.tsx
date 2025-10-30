import { useState } from "react";
import { MenuBar } from "../components/MenuBar";
import { SideNav } from "../components/SideBar";
import { SkyDisplay } from "../components/SkyDisplay";

export default function Display() {
  const [sideBarOpen, setSideBarOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-black">
      <MenuBar onMenuClick={() => setSideBarOpen(true)} />
      
      <main className="flex-1 relative">
        <SkyDisplay />
      </main>
      
      <SideNav open={sideBarOpen} onOpenChange={setSideBarOpen} />
    </div>
  );
}