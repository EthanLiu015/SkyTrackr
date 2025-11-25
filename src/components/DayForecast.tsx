import { Cloud, CloudRain, Sun, CloudSnow, CloudDrizzle, Wind, Eye } from "lucide-react";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";

const weatherIcons = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
  drizzle: CloudDrizzle,
};

const daysData = [
  { day: "Mon", high: 75, low: 62, weather: "sunny", starVisibility: 85, cloudCover: "15%", transparency: "85%", seeing: "8/10", smoke: "Low", darkness: "15%", lightPollution: "Low" },
  { day: "Tue", high: 73, low: 60, weather: "cloudy", starVisibility: 65, cloudCover: "60%", transparency: "65%", seeing: "6/10", smoke: "Low", darkness: "35%", lightPollution: "Moderate" },
  { day: "Wed", high: 68, low: 58, weather: "rainy", starVisibility: 40, cloudCover: "90%", transparency: "40%", seeing: "4/10", smoke: "Moderate", darkness: "60%", lightPollution: "High" },
  { day: "Thu", high: 70, low: 59, weather: "cloudy", starVisibility: 70, cloudCover: "55%", transparency: "70%", seeing: "6/10", smoke: "Low", darkness: "30%", lightPollution: "Moderate" },
  { day: "Fri", high: 76, low: 63, weather: "sunny", starVisibility: 90, cloudCover: "10%", transparency: "90%", seeing: "9/10", smoke: "Low", darkness: "10%", lightPollution: "Low" },
  { day: "Sat", high: 78, low: 65, weather: "sunny", starVisibility: 88, cloudCover: "20%", transparency: "88%", seeing: "9/10", smoke: "Low", darkness: "12%", lightPollution: "Low" },
  { day: "Sun", high: 72, low: 61, weather: "drizzle", starVisibility: 55, cloudCover: "75%", transparency: "55%", seeing: "5/10", smoke: "Moderate", darkness: "45%", lightPollution: "Moderate" },
];

export function DayForecast() {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 pb-4">
        {daysData.map((day, index) => {
          const WeatherIcon = weatherIcons[day.weather as keyof typeof weatherIcons];
          
          // Calculate gradient colors - high visibility = dark, low visibility = light
          const lowVisColor = [180, 190, 210]; // Light blue-gray for low visibility
          const highVisColor = [5, 10, 20]; // Almost black for high visibility
          const ratio = day.starVisibility / 100;
          const r = Math.round(lowVisColor[0] + (highVisColor[0] - lowVisColor[0]) * ratio);
          const g = Math.round(lowVisColor[1] + (highVisColor[1] - lowVisColor[1]) * ratio);
          const b = Math.round(lowVisColor[2] + (highVisColor[2] - lowVisColor[2]) * ratio);
          
          return (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 text-center hover:bg-white/10 transition-all duration-300 border border-white/10 min-w-[200px] flex-shrink-0"
            >
              <p className="text-white mb-3 opacity-90">{day.day}</p>
              <WeatherIcon className="w-10 h-10 text-white mx-auto mb-3" />
              <div className="flex justify-center gap-2 mb-4">
                <span className="text-white">{day.high}°</span>
                <span className="text-white/60">{day.low}°</span>
              </div>
              
              {/* Visibility - Larger and more prominent */}
              <div 
                className="rounded-lg p-2 mb-3 border border-blue-400/30"
                style={{
                  backgroundColor: `rgb(${r}, ${g}, ${b})`,
                }}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Eye className="w-4 h-4 text-blue-300" />
                  <span className="text-xs text-blue-200">Star Visibility</span>
                </div>
                <p className="text-white text-lg">{day.starVisibility}%</p>
              </div>
              
              {/* Other stats - Smaller */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Cloud Cover</span>
                  <span>{day.cloudCover}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Transparency</span>
                  <span>{day.transparency}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Seeing</span>
                  <span>{day.seeing}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Smoke</span>
                  <span>{day.smoke}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="opacity-70">Darkness</span>
                  <span>{day.darkness}</span>
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