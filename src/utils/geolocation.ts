export type DetectedCoordinates = {
  latitude: string;
  longitude: string;
  accuracy: number | null;
};

const geolocationErrorMessage = (error: GeolocationPositionError): string => {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Allow location access in your browser and try again.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your current location is unavailable. Check your device location settings and try again.";
  }
  if (error.code === error.TIMEOUT) {
    return "Location detection timed out. Please try again.";
  }
  return "Unable to detect your current location.";
};

export const detectCurrentCoordinates = (
  decimalPlaces = 7,
): Promise<DetectedCoordinates> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location detection is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude.toFixed(decimalPlaces),
          longitude: position.coords.longitude.toFixed(decimalPlaces),
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        });
      },
      (error) => reject(new Error(geolocationErrorMessage(error))),
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
      },
    );
  });
