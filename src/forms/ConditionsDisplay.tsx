import { DayForecast } from "../components/DayForecast";
import { HourlyForecast } from "../components/HourlyForecast";
import { Lightbulb, Eye } from "lucide-react";

export function ConditionsDisplay() {
  // Current visibility (using a sample value - in a real app this would come from API)
  const currentVisibility = 75; // This represents current star visibility percentage

  return (
    <div className="w-full bg-black">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-10 h-10 text-blue-300" />
            <h1 className="text-5xl">{currentVisibility}%</h1>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-yellow-300" />
            <p className="text-sm opacity-80">Light Pollution: Low</p>
          </div>
          <p className="text-xl opacity-90">Partly Cloudy</p>
        </div>

        {/* 7-Day Forecast */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-white/20 shadow-2xl">
          <h2 className="text-white mb-4 text-lg">7-Day Forecast</h2>
          <DayForecast />
        </div>

        {/* 24-Hour Forecast */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl">
          <h2 className="text-white mb-4 text-lg">24-Hour Forecast</h2>
          <HourlyForecast />
        </div>
      </div>
    </div>
  );
}