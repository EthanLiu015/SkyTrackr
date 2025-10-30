import { useState } from "react";
import LandingPage from "./forms/LandingPage";
import Display from "./forms/Display";

export default function App() {
  const [currentPage, setCurrentPage] = useState<"landing" | "display">("landing");

  return (
    <>
      {currentPage === "landing" && <LandingPage onStartJourney={() => setCurrentPage("display")} />}
      {currentPage === "display" && <Display />}
    </>
  );
}