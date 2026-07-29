import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { LatLngTuple, Map } from "leaflet";

import {
  createBinIcon,
  DEFAULT_CENTER,
  HOUSEHOLD_STATUS_META,
  spreadPositions,
  type HouseholdStatus,
} from "./mapUtils";
import { binApi, binCollectionEventApi } from "@/helpers/admin";
import { useTranslation } from "react-i18next";

type ApiBin = {
  unique_id: string;
  bin_name: string;
  ward_name?: string;
  ward?: string;
  bin_type?: string;
  waste_type?: string;
  color_code?: string;
  capacity_liters?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  installation_date?: string;
  expected_life_years?: number | string;
  bin_status?: string;
  is_active?: boolean;
};

type ApiBinCollectionEvent = {
  bin_id?: string;
  bin?: { unique_id?: string };
  status?: string;
  collection_date?: string;
  created_at?: string;
  collected_weight_kg?: number | string;
};

type CollectionMeta = {
  lastCollectedOn?: string;
  collectedWeightKg?: number;
};

type Bin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: HouseholdStatus;
  wardName?: string;
  installedDate?: string;
  binType?: string;
  wasteType?: string;
  capacityLiters?: number;
  binCondition?: string;
  colorCode?: string;
  expectedLifeYears?: number;
  isActive?: boolean;
  lastCollectedOn?: string;
  collectedWeightKg?: number;
};

const parseCoordinate = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumberOrUndefined = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatLabel = (value?: string) => {
  if (!value) return undefined;
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDateTime = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const buildBin = (
  bin: ApiBin,
  lat: number,
  lng: number,
  collectedMeta: Map<string, CollectionMeta>
): Bin => {
  const id = String(bin.unique_id ?? "");
  const meta = collectedMeta.get(id);
  return {
    id,
    name: bin.bin_name || bin.unique_id || "Unnamed Bin",
    lat,
    lng,
    status: meta ? "collected" : "not_collected",
    wardName: bin.ward_name || bin.ward || undefined,
    installedDate: bin.installation_date || undefined,
    binType: formatLabel(bin.bin_type),
    wasteType: formatLabel(bin.waste_type),
    capacityLiters: toNumberOrUndefined(bin.capacity_liters),
    binCondition: formatLabel(bin.bin_status),
    colorCode: bin.color_code || undefined,
    expectedLifeYears: toNumberOrUndefined(bin.expected_life_years),
    isActive: bin.is_active,
    lastCollectedOn: meta?.lastCollectedOn,
    collectedWeightKg: meta?.collectedWeightKg,
  };
};

type BinMapContentProps = {
  map: Map | null;
  params: Record<string, string>;
  statusFilter: Record<HouseholdStatus, boolean>;
  setStatusFilter: React.Dispatch<React.SetStateAction<Record<HouseholdStatus, boolean>>>;
  focusedId: string;
  setFocusedId: (id: string) => void;
  selectedBin: Bin | null;
  setSelectedBin: (b: Bin | null) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
};

export function BinMapContent({
  map,
  params,
  statusFilter,
  setStatusFilter,
  focusedId,
  setFocusedId,
  selectedBin,
  setSelectedBin,
  panelOpen,
  setPanelOpen,
}: BinMapContentProps) {
  const { t } = useTranslation();
  const markersRef = useRef<L.Marker[]>([]);
  const [binRecords, setBinRecords] = useState<ApiBin[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<ApiBinCollectionEvent[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchBins = async () => {
      const today = new Date().toISOString().split("T")[0];
      const config = Object.keys(params).length ? { params } : undefined;
      try {
        const [binResponse, collectionResponse] = await Promise.all([
          binApi.readAll(config),
          binCollectionEventApi.readAll({ params: { collection_date: today, ...params } }),
        ]);
        if (!isMounted) return;
        setBinRecords(Array.isArray(binResponse) ? binResponse : []);
        setCollectionRecords(Array.isArray(collectionResponse) ? collectionResponse : []);
      } catch {
        if (!isMounted) return;
        setBinRecords([]);
        setCollectionRecords([]);
      }
    };

    fetchBins();
    return () => { isMounted = false; };
  }, [JSON.stringify(params)]);

  const bins = useMemo(() => {
    const collectedMeta = new Map<string, CollectionMeta>();
    collectionRecords.forEach((event) => {
      if (event.status !== "Collected") return;
      const binId = String(event.bin_id ?? event.bin?.unique_id ?? "").trim();
      if (!binId) return;
      collectedMeta.set(binId, {
        lastCollectedOn: formatDateTime(event.collection_date || event.created_at),
        collectedWeightKg: toNumberOrUndefined(event.collected_weight_kg),
      });
    });

    const active = binRecords.filter((bin) => bin.is_active !== false);

    const withCoords: Bin[] = [];
    const missingCoords: ApiBin[] = [];

    active.forEach((bin) => {
      const lat = parseCoordinate(bin.latitude);
      const lng = parseCoordinate(bin.longitude);
      if (lat === null || lng === null) {
        missingCoords.push(bin);
        return;
      }
      withCoords.push(buildBin(bin, lat, lng, collectedMeta));
    });

    const center: LatLngTuple = withCoords.length
      ? [
          withCoords.reduce((sum, b) => sum + b.lat, 0) / withCoords.length,
          withCoords.reduce((sum, b) => sum + b.lng, 0) / withCoords.length,
        ]
      : DEFAULT_CENTER;
    const fallbackPositions = spreadPositions(missingCoords.length, center);

    const synthesized: Bin[] = missingCoords.map((bin, i) =>
      buildBin(bin, fallbackPositions[i][0], fallbackPositions[i][1], collectedMeta)
    );

    return [...withCoords, ...synthesized];
  }, [binRecords, collectionRecords]);

  const filteredBins = useMemo(
    () => bins.filter((b) => statusFilter[b.status]),
    [bins, statusFilter]
  );

  useEffect(() => {
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredBins.forEach((bin) => {
      const pos: LatLngTuple = [bin.lat, bin.lng];
      const isFocused = bin.id === focusedId;
      const marker = L.marker(pos, {
        icon: createBinIcon(bin.status, isFocused),
        title: bin.name,
      })
        .addTo(map)
        .bindPopup(
          `<strong>${bin.name}</strong><br/>
           ${t("common.status")}: ${t(HOUSEHOLD_STATUS_META[bin.status].labelKey)}<br/>
           ${t("common.ward")}: ${bin.wardName ?? "—"}`,
          { closeButton: false, autoClose: false, closeOnClick: false }
        )
        .on("mouseover", () => marker.openPopup())
        .on("mouseout", () => marker.closePopup())
        .on("click", (e) => {
          e.originalEvent?.preventDefault();
          setFocusedId(bin.id);
          setSelectedBin(bin);
          setPanelOpen(true);
        });
      markersRef.current.push(marker);
    });

    if (filteredBins.length > 1) map.fitBounds(filteredBins.map((b) => [b.lat, b.lng] as LatLngTuple), { padding: [40, 40], maxZoom: 16 });
    else if (filteredBins.length === 1) map.setView([filteredBins[0].lat, filteredBins[0].lng], 15);
    else map.setView(DEFAULT_CENTER, 13);
  }, [map, filteredBins, focusedId, selectedBin, t]);

  useEffect(() => {
    if (!selectedBin || !map) return;
    const marker = markersRef.current.find((m) => m.getLatLng().lat === selectedBin.lat && m.getLatLng().lng === selectedBin.lng);
    if (marker) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), { animate: true });
      marker.openPopup();
    }
  }, [selectedBin, map]);

  return null;
}