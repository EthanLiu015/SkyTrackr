export interface UserLocation {
  latitude: number;
  longitude: number;
}

export function getUserLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        // If geolocation fails, use a default location (San Francisco)
        console.warn('Geolocation failed, using default location:', error);
        resolve({
          latitude: 37.7749,
          longitude: -122.4194,
        });
      }
    );
  });
}
