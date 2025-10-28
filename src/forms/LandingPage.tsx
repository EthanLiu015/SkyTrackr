import { Button } from "../components/button.tsx";
import { ArrowRight } from "lucide-react";
import starsImage from "../assets/images/constellation_stars.png";

// Import Google Fonts
const fontLink = document.createElement("link");
fontLink.href =
  "https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700;800;900&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

export default function LandingPage() {
  return (
    <div className="relative w-screen h-screen bg-[#1a1a1a] overflow-hidden flex items-center justify-center">
      {/* Sparkle decoration in top right corner */}
      <img
        src={starsImage}
        alt="stars decoration"
        className="absolute top-[10%] right-[15%] w-[20vw] h-[20vw] object-contain opacity-70"
      />
      <div className="flex flex-col items-center justify-center gap-12 px-8">
        <h1
          className="text-white text-center tracking-tight text-8xl font-['Exo_2',sans-serif]"
          style={{
            textShadow: `
              0 0 10px rgba(147, 197, 253, 0.8),
              0 0 20px rgba(147, 197, 253, 0.6),
              0 0 30px rgba(147, 197, 253, 0.4),
              0 0 40px rgba(147, 197, 253, 0.3),
              0 0 70px rgba(147, 197, 253, 0.2),
              0 0 100px rgba(147, 197, 253, 0.1)
            `,
          }}
        >
          Welcome to SkyTrackr!
        </h1>

        <Button
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-[4.438rem] py-9 gap-4 transition-all hover:scale-105 text-xl"
          style={{
            boxShadow: `
              0 0 15px rgba(96, 165, 250, 0.6),
              0 0 30px rgba(96, 165, 250, 0.4),
              0 0 45px rgba(96, 165, 250, 0.3),
              0 0 60px rgba(96, 165, 250, 0.2)
            `,
          }}
        >
          Start your Journey
          <ArrowRight className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}