import { useState } from "react";
import { LoaderCircle, LocateFixed } from "lucide-react";

import Swal from "@/lib/notify";
import { Button } from "@/components/ui/button";
import {
  detectCurrentCoordinates,
  type DetectedCoordinates,
} from "@/utils/geolocation";

type AutoDetectLocationButtonProps = {
  onDetected: (coordinates: DetectedCoordinates) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export default function AutoDetectLocationButton({
  onDetected,
  label = "Auto detect location",
  className,
  disabled = false,
}: AutoDetectLocationButtonProps) {
  const [detecting, setDetecting] = useState(false);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      onDetected(await detectCurrentCoordinates());
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Location not detected",
        text: error instanceof Error ? error.message : "Unable to detect your current location.",
      });
    } finally {
      setDetecting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={disabled || detecting}
      onClick={detectLocation}
    >
      {detecting ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <LocateFixed className="h-4 w-4" />
      )}
      {detecting ? "Detecting..." : label}
    </Button>
  );
}
