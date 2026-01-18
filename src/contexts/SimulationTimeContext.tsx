import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';

interface SimulationTimeContextType {
  simulationTime: Date;
  speed: number;
  isPaused: boolean;
  setSpeed: (speed: number) => void;
  togglePause: () => void;
  setSimulationTime: (time: Date) => void;
}

const SimulationTimeContext = createContext<SimulationTimeContextType | undefined>(undefined);

export const SimulationTimeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [speed, setSpeedState] = useState(1); // 1x real-time speed
  const [isPaused, setIsPaused] = useState(false);
  const [simulationTime, setSimulationTimeState] = useState(new Date());

  // Refs to maintain accurate time tracking independent of render cycles
  const timeRef = useRef({
    baseTime: Date.now(),    // The simulation time at the last anchor update
    anchorTime: Date.now(),  // The real system time at the last anchor update
    speed: 1,
    isPaused: false,
  });

  // Updates the anchor points. Call this before changing speed or pause state.
  const updateAnchor = () => {
    const now = Date.now();
    const { baseTime, anchorTime, speed, isPaused } = timeRef.current;
    
    let currentSimTime = baseTime;
    if (!isPaused) {
      currentSimTime += (now - anchorTime) * speed;
    }

    timeRef.current.baseTime = currentSimTime;
    timeRef.current.anchorTime = now;
  };

  const setSpeed = (newSpeed: number) => {
    updateAnchor();
    timeRef.current.speed = newSpeed;
    setSpeedState(newSpeed);
  };

  const togglePause = () => {
    updateAnchor();
    const newPaused = !timeRef.current.isPaused;
    timeRef.current.isPaused = newPaused;
    setIsPaused(newPaused);
  };

  const setSimulationTime = (date: Date) => {
    timeRef.current.baseTime = date.getTime();
    timeRef.current.anchorTime = Date.now();
    setSimulationTimeState(date);
  };

  // Animation loop to update the exposed simulationTime
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      const now = Date.now();
      const { baseTime, anchorTime, speed, isPaused } = timeRef.current;

      let currentSimTime = baseTime;
      if (!isPaused) {
        currentSimTime += (now - anchorTime) * speed;
      }

      setSimulationTimeState(new Date(currentSimTime));
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <SimulationTimeContext.Provider
      value={{ simulationTime, speed, isPaused, setSpeed, togglePause, setSimulationTime }}
    >
      {children}
    </SimulationTimeContext.Provider>
  );
};

export const useSimulationTime = () => {
  const context = useContext(SimulationTimeContext);
  if (context === undefined) {
    throw new Error('useSimulationTime must be used within a SimulationTimeProvider');
  }
  return context;
};