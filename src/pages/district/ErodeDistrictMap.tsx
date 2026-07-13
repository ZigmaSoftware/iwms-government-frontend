import { MapPin } from "lucide-react";

/* ─── Erode district boundary ─────────────────────────────────────────
   Path lifted from the state-wide Erode shape in src/data/tamilnadu-map.ts
   (700×951 TN coordinate space). The viewBox below crops tightly to the
   district's bounding box (x 102–289, y 279–440) so it renders as a
   standalone single-district map. Swap ERODE_PATH for a higher-detail
   GeoJSON-derived outline if one becomes available. ── */
const ERODE_PATH =
  "M245.5,279.0 L247.1,292.0 L243.1,291.8 L243.8,301.2 L251.4,303.6 L253.4,306.2 L249.1,316.6 L247.8,331.0 L252.1,331.5 L257.9,328.9 L260.1,331.4 L255.8,339.5 L257.5,345.1 L253.6,351.5 L254.9,355.6 L249.0,363.5 L246.7,370.7 L252.6,378.5 L256.9,380.9 L268.2,397.8 L273.3,398.7 L277.8,402.4 L277.1,411.2 L281.0,416.9 L282.2,430.2 L289.2,431.9 L287.4,435.4 L280.4,439.8 L271.8,435.8 L269.7,431.9 L262.6,433.9 L256.1,429.2 L243.0,426.0 L235.4,422.0 L225.5,425.1 L215.6,425.4 L213.3,413.0 L217.4,411.6 L215.6,404.9 L209.4,399.2 L211.3,391.7 L201.7,390.2 L196.2,388.2 L187.4,389.1 L189.4,396.0 L179.2,393.4 L167.6,383.0 L159.0,389.1 L155.5,385.8 L150.0,378.4 L138.2,374.3 L132.8,380.1 L124.2,377.3 L127.2,374.5 L127.6,367.7 L132.6,365.7 L129.0,360.6 L132.7,353.2 L123.7,345.0 L114.2,343.5 L105.6,343.9 L104.4,341.0 L102.3,333.1 L105.0,325.0 L111.4,316.9 L114.9,306.2 L125.3,309.3 L127.6,305.3 L132.7,302.8 L137.0,306.4 L144.6,315.8 L149.5,315.4 L149.3,309.9 L162.6,306.7 L171.1,306.3 L172.9,303.1 L180.5,303.8 L187.5,310.3 L197.7,307.8 L203.3,311.1 L207.0,306.0 L209.7,292.4 L213.9,286.5 L214.3,280.9 L222.1,282.4 L225.9,280.8 L233.4,281.5 L245.5,279.0 Z";

/* tight crop around the Erode bounding box with a little breathing room */
const VIEWBOX = "92 269 205 181";

/* Erode city marker, in the same coordinate space as the path.
   Kept well inside the boundary (near the district centroid ~195.8,359.4)
   so the pin tip never lands on the outline edge. */
const MARKER = { x: 202, y: 352 };
const VB = { x: 92, y: 269, w: 205, h: 181 };
const markerLeft = ((MARKER.x - VB.x) / VB.w) * 100;
const markerTop = ((MARKER.y - VB.y) / VB.h) * 100;

type Props = {
  /** overrides the marker label (defaults to "Erode") */
  cityLabel?: string;
  className?: string;
};

export default function ErodeDistrictMap({ cityLabel = "Erode", className = "" }: Props) {
  return (
    <div
      className={`relative flex flex-col items-center rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 ${className}`}
    >
      {/* header */}
      <p className="text-[11px] font-semibold tracking-[0.28em] text-slate-400 uppercase">
        Tamil Nadu &middot; India
      </p>
      <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Erode District</h3>

      {/* map */}
      <div className="relative w-full max-w-md mt-4">
        <svg viewBox={VIEWBOX} className="w-full h-auto" role="img" aria-label="Map of Erode district">
          <path
            d={ERODE_PATH}
            fill="#ffffff"
            stroke="#111827"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* city marker overlay */}
        <div
          className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
          style={{ left: `${markerLeft}%`, top: `${markerTop}%` }}
        >
          <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
            {cityLabel}
          </span>
          <MapPin className="-mt-0.5 h-6 w-6 text-red-600 drop-shadow-sm" fill="#dc2626" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
