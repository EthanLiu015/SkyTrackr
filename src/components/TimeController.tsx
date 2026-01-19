import React, { useState } from 'react';
import { useSimulationTime } from '../contexts/SimulationTimeContext';
import { ChevronUp, ChevronDown, Clock, RotateCcw, X } from 'lucide-react';
import { Button } from './ui/button';

export function TimeController() {
  const { simulationTime, setSimulationTime } = useSimulationTime();
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to format date parts
  const format = (num: number) => num.toString().padStart(2, '0');

  const year = simulationTime.getFullYear();
  const month = simulationTime.getMonth() + 1;
  const day = simulationTime.getDate();
  const hour = simulationTime.getHours();
  const minute = simulationTime.getMinutes();

  const updateTime = (unit: 'year' | 'month' | 'day' | 'hour' | 'minute', change: number) => {
    const newTime = new Date(simulationTime);
    switch (unit) {
      case 'year':
        newTime.setFullYear(year + change);
        break;
      case 'month':
        newTime.setMonth(month - 1 + change);
        break;
      case 'day':
        newTime.setDate(day + change);
        break;
      case 'hour':
        newTime.setHours(hour + change);
        break;
      case 'minute':
        newTime.setMinutes(minute + change);
        break;
    }
    setSimulationTime(newTime);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSimulationTime(new Date());
  };

  if (!isExpanded) {
    return (
      <div
        className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg p-3 cursor-pointer hover:bg-black/70 transition-all text-white flex items-center gap-2 z-50"
        onClick={() => setIsExpanded(true)}
      >
        <Clock className="w-4 h-4" />
        <span className="font-mono text-sm">
          {year}-{format(month)}-{format(day)} {format(hour)}:{format(minute)}
        </span>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-4 text-white z-50 flex flex-col gap-4 min-w-[320px] shadow-xl">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm">Time Control</span>
        </div>
        <button 
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
            className="text-white/60 hover:text-white transition-colors"
        >
            <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-center items-center gap-1 font-mono text-lg select-none">
        <TimeUnit value={year} label="YYYY" onChange={(v) => updateTime('year', v)} />
        <span className="text-white/40 pb-4">-</span>
        <TimeUnit value={month} label="MM" onChange={(v) => updateTime('month', v)} pad={2} />
        <span className="text-white/40 pb-4">-</span>
        <TimeUnit value={day} label="DD" onChange={(v) => updateTime('day', v)} pad={2} />
        <span className="w-2"></span>
        <TimeUnit value={hour} label="HH" onChange={(v) => updateTime('hour', v)} pad={2} />
        <span className="text-white/40 pb-4">:</span>
        <TimeUnit value={minute} label="MM" onChange={(v) => updateTime('minute', v)} pad={2} />
      </div>

      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleReset}
        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border-white/20 text-white hover:text-white"
      >
        <RotateCcw className="w-3 h-3" />
        Reset to Current Time
      </Button>
    </div>
  );
}

interface TimeUnitProps {
  value: number;
  label: string;
  onChange: (change: number) => void;
  pad?: number;
}

function TimeUnit({ value, label, onChange, pad = 0 }: TimeUnitProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button 
        onClick={(e) => { e.stopPropagation(); onChange(1); }}
        className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-blue-400 transition-colors active:scale-95"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <div className="bg-black/40 rounded px-2 py-1 min-w-[2ch] text-center border border-white/5">
        {pad ? value.toString().padStart(pad, '0') : value}
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onChange(-1); }}
        className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-blue-400 transition-colors active:scale-95"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      <span className="text-[10px] text-white/30 uppercase font-sans tracking-wider">{label}</span>
    </div>
  );
}