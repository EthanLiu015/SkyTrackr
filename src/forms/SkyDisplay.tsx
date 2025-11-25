export function SkyDisplay() {
  return (
    <div className="w-full h-full bg-gradient-to-b from-[#0a0a1a] via-[#1a1a3a] to-[#2a2a4a] relative overflow-hidden">
      {/* Placeholder for Three.js implementation */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-gray-400 space-y-4">
          <div className="text-6xl">🌌</div>
          <p className="text-lg">Three.js Night Sky Display</p>
          <p className="text-sm opacity-70">My Three.js canvas will be integrated here</p>
        </div>
      </div>
      
      {/* Decorative stars as placeholder */}
      <div className="absolute top-[10%] left-[15%] w-2 h-2 bg-white rounded-full animate-pulse" />
      <div className="absolute top-[20%] right-[25%] w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="absolute top-[40%] left-[30%] w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-[60%] right-[40%] w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-[30%] left-[60%] w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.8s' }} />
      <div className="absolute bottom-[20%] left-[20%] w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '1.2s' }} />
      <div className="absolute bottom-[40%] right-[15%] w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
    </div>
  );
}
