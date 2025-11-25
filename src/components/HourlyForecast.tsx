import { Cloud, CloudRain, Sun, CloudSnow, CloudDrizzle, Eye } from "lucide-react";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";

const weatherIcons = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
  drizzle: CloudDrizzle,
};

// Generate 24 hours of data
const generateHourlyData = () => {
  const weathers = ["sunny", "cloudy", "rainy", "drizzle", "cloudy"];
  const smokeOptions = ["Low", "Moderate", "High"];
  const lightPollutionOptions = ["Low", "Moderate", "High"];
  const hours = [];
  
  for (let i = 0; i < 24; i++) {
    const hour = i === 0 ? "Now" : i < 12 ? `${i}AM` : i === 12 ? "12PM" : `${i - 12}PM`;
    const temp = Math.floor(Math.random() * 15) + 60; // 60-75°F
    const weather = weathers[Math.floor(Math.random() * weathers.length)];
    const starVisibility = Math.floor(Math.random() * 60) + 30; // 30-90%
    const cloudCover = Math.floor(Math.random() * 80) + 10; // 10-90%
    const transparency = 100 - cloudCover + Math.floor(Math.random() * 20) - 10; // Inversely related to cloud cover
    const seeing = Math.floor(Math.random() * 6) + 4; // 4-10
    const smoke = smokeOptions[Math.floor(Math.random() * smokeOptions.length)];
    const darkness = Math.floor(Math.random() * 80) + 10; // 10-90%
    const lightPollution = lightPollutionOptions[Math.floor(Math.random() * lightPollutionOptions.length)];
    
    hours.push({ 
      hour, 
      temp, 
      weather, 
      starVisibility,
      cloudCover: `${cloudCover}%`,
      transparency: `${transparency}%`,
      seeing: `${seeing}/10`,
      smoke,
      darkness: `${darkness}%`,
      lightPollution
    });
  }
  
  return hours;
};

const hourlyData = generateHourlyData();

export function HourlyForecast() {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 pb-4">
        {hourlyData.map((data, index) => {
          const WeatherIcon = weatherIcons[data.weather as keyof typeof weatherIcons];
          
          // Calculate gradient colors - high visibility = dark, low visibility = light
          const lowVisColor = [180, 190, 210]; // Light blue-gray for low visibility
          const highVisColor = [5, 10, 20]; // Almost black for high visibility
          const ratio = data.starVisibility / 100;
          const r = Math.round(lowVisColor[0] + (highVisColor[0] - lowVisColor[0]) * ratio);
          const g = Math.round(lowVisColor[1] + (highVisColor[1] - lowVisColor[1]) * ratio);
          const b = Math.round(lowVisColor[2] + (highVisColor[2] - lowVisColor[2]) * ratio);
          
          return (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 text-center hover:bg-white/10 transition-all duration-300 border border-white/10 min-w-[200px] flex-shrink-0"
            >
              <p className="text-white mb-3 opacity-90 text-sm">{data.hour}</p>
              <WeatherIcon className="w-8 h-8 text-white mx-auto mb-3" />
              <p className="text-white mb-4 text-lg">{data.temp}°</p>
              
              {/* Visibility - Larger and more prominent */}
              <div 
                className="rounded-lg p-2 mb-3 border border-blue-400/30"
                style={{
                  backgroundColor: `rgb(${r}, ${g}, ${b})`,
                }}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Eye className="w-4 h-4 text-blue-300" />
                  <span className="text-xs text-blue-200">Visibility</span>
                </div>
                <p className="text-white">{data.starVisibility}%</p>
              </div>
              
              {/* Other stats - Smaller */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Cloud Cover</span>
                  <span>{data.cloudCover}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Transparency</span>
                  <span>{data.transparency}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Seeing</span>
                  <span>{data.seeing}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Smoke</span>
                  <span>{data.smoke}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Darkness</span>
                  <span>{data.darkness}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}