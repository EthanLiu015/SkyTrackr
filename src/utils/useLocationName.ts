import { useState, useEffect } from "react";
import { getUserLocation } from "./geolocation";

// Global cache to store the location name and the pending promise
// This ensures we only fetch the location once per session
let cachedLocationName: string | null = null;
let fetchingPromise: Promise<string> | null = null;

export function useLocationName() {
  const [locationName, setLocationName] = useState<string>(cachedLocationName || "Locating...");

  useEffect(() => {
    // If we already have a cached location, use it immediately
    if (cachedLocationName) {
      setLocationName(cachedLocationName);
      return;
    }

    // If a fetch is not already in progress, start one
    if (!fetchingPromise) {
      fetchingPromise = (async () => {
        try {
          const location = await getUserLocation();
          if (location.latitude && location.longitude) {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=en`
            );
            const data = await response.json();
            if (data.city) {
              const name = `${data.city}, ${data.principalSubdivision || data.countryName}`;
              cachedLocationName = name;
              return name;
            }
          }
          return "Location Unavailable";
        } catch (error) {
          console.error("Error fetching location:", error);
          return "Location Unavailable";
        }
      })();
    }

    // Wait for the promise (whether new or existing) to resolve
    fetchingPromise.then((name) => {
      setLocationName(name);
    });
  }, []);

  return locationName;
}