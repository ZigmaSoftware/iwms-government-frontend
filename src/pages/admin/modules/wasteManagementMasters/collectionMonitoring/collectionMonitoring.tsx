import type { CustomerLocation, CustomerRecord, Vehicle, VehicleStatus } from "./types";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import flatpickr from "flatpickr";
import type { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";
import { customerCreationApi, wasteCollectionApi } from "@/helpers/admin";
import "./collectionMonitor.css";
import "../../../../../components/map/adminMapPanel.css";
import "flatpickr/dist/flatpickr.min.css";
import {
  filterActiveCustomers,
  normalizeCustomerArray,
} from "@/utils/customerUtils";
import { useTranslation } from "react-i18next";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";


const COLLECTION_MONITORING_FIELDS: Record<string, string[]> = {
  date: ["date", "collection_date", "fromDate"],
  zone: ["zone", "zone_name"],
  ward: ["ward", "ward_name"],
  customer: ["customer", "customer_id", "customer_name"],
  vehicle: ["vehicle", "vehicle_no", "vehicle_number"],
  collection_status: ["collection_status", "status"],
  collected_count: ["collected_count", "collected"],
  not_collected_count: ["not_collected_count", "not_collected"],
  total_household_count: ["total_household_count", "total_household"],
  address: ["address", "building_no", "street", "area"],
  latitude: ["latitude"],
  longitude: ["longitude"],
  speed: ["speed"],
  ignition: ["ignition"],
  distance: ["distance"],
  location: ["location"],
  updated_at: ["updated_at", "updatedAt"],
};

const parseCoordinate = (value?: number | string | null) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/,/g, ".");
  const match = normalized.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const VEHICLE_STATUS_COLORS: Record<VehicleStatus, string> = {
  Running: "#66E066",
  Idle: "#FFB03F",
  Parked: "#808080",
  "No Data": "#999",
};

const createTruckIcon = (status: VehicleStatus, isFocused: boolean) => {
  const color = VEHICLE_STATUS_COLORS[status];
  const size = isFocused ? 38 : 30;
  const pulseSize = Math.round(size * 1.2);

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div class="truck-marker ${isFocused ? "focused" : ""}" style="width:${size}px;height:${size}px;background:${color};--accent:${color};">
        ${
          isFocused
            ? `<span class="truck-pulse" style="width:${pulseSize}px;height:${pulseSize}px;"></span>`
            : ""
        }
        <span class="truck-emoji">🚛</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const createHouseIcon = (color: string, isFocused: boolean) => {
  const size = isFocused ? 40 : 32;
  const pulseSize = Math.round(size * 1.15);

  return L.divIcon({
    className: "custom-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div class="house-marker ${isFocused ? "focused" : ""}" style="width:${size}px;height:${size}px;background:${color};--accent:${color};">
        ${
          isFocused
            ? `<span class="house-pulse" style="width:${pulseSize}px;height:${pulseSize}px;"></span>`
            : ""
        }
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="house-icon"
        >
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        </svg>
      </div>
    `,
  });
};

const pickCoordinate = (record: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = record?.[key];
    const parsed = parseCoordinate(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const WasteCollectionMonitor: React.FC = () => {
  const { t } = useTranslation();
  const { showField } = useFieldVisibility(
    "waste-management",
    "collection-monitoring",
    COLLECTION_MONITORING_FIELDS
  );
  const [fromDate, setFromDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [zone, setZone] = useState<string>("");
  const [ward, setWard] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const datepickerRef = useRef<HTMLInputElement | null>(null);
  const fpInstance = useRef<FlatpickrInstance | null>(null);

  const [collectedCount, setCollectedCount] = useState<number>(0);
  const [notCollectedCount, setNotCollectedCount] = useState<number>(0);
  const [totalHouseholdCount, setTotalHouseholdCount] = useState<number>(0);
  const [customerLocations, setCustomerLocations] = useState<CustomerLocation[]>([]);
  const [collectedCustomerIds, setCollectedCustomerIds] = useState<string[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerRecord[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<string>("not_collected");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [map, setMap] = useState<L.Map | null>(null);
  const [focusedVehicleId, setFocusedVehicleId] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const vehicleMarkerLookupRef = useRef<Record<string, L.Marker>>({});
  const getVehicleStatusLabel = (status: VehicleStatus) => {
    switch (status) {
      case "Running":
        return t("dashboard.live_map.status_running");
      case "Idle":
        return t("dashboard.live_map.status_idle");
      case "Parked":
        return t("dashboard.live_map.status_parked");
      case "No Data":
        return t("dashboard.live_map.status_no_data");
      default:
        return status;
    }
  };
  const statusOptions = [
    {
      label: t("common.not_collected"),
      value: "not_collected",
      count: notCollectedCount,
      activeBg: "bg-red-100",
      activeText: "text-red-800",
      activeDot: "bg-red-500",
    },
    {
      label: t("common.collected"),
      value: "collected",
      count: collectedCount,
      activeBg: "bg-green-100",
      activeText: "text-green-800",
      activeDot: "bg-green-500",
    },
    {
      label: t("admin.collection_monitoring.total_household"),
      value: "total_household",
      count: totalHouseholdCount,
      activeBg: "bg-blue-100",
      activeText: "text-blue-800",
      activeDot: "bg-blue-500",
    },
  ];

  const collectedCustomerLocations = useMemo(() => {
    const idSet = new Set(collectedCustomerIds);
    return customerLocations.filter((location) => idSet.has(location.id));
  }, [customerLocations, collectedCustomerIds]);

  const notCollectedCustomerLocations = useMemo(() => {
    const idSet = new Set(collectedCustomerIds);
    return customerLocations.filter((location) => !idSet.has(location.id));
  }, [customerLocations, collectedCustomerIds]);

  const zoneOptions = useMemo(() => {
    const zones = Array.from(
      new Set(
        allCustomers
          .map((customer) => customer.zone_name)
          .filter((value) => typeof value === "string" && value.trim())
      )
    ).sort();
    return zones.map((value) => ({ value, label: value }));
  }, [allCustomers]);

  const wardOptions = useMemo(() => {
    const filtered = zone
      ? allCustomers.filter((customer) => customer.zone_name === zone)
      : allCustomers;
    const wards = Array.from(
      new Set(
        filtered
          .map((customer) => customer.ward_name)
          .filter((value) => typeof value === "string" && value.trim())
      )
    ).sort();
    return wards.map((value) => ({ value, label: value }));
  }, [allCustomers, zone]);

  const customerOptions = useMemo(() => {
    const filteredByZone = zone
      ? allCustomers.filter((customer) => customer.zone_name === zone)
      : allCustomers;
    const filteredByWard = ward
      ? filteredByZone.filter((customer) => customer.ward_name === ward)
      : filteredByZone;
    return filteredByWard.map((customer) => ({
      value: String(customer.unique_id ?? customer.id ?? ""),
      label: customer.customer_name,
    }));
  }, [allCustomers, zone, ward]);

  const hasSelectedCustomer = !!customerId;

  const selectedCustomerLocation = useMemo(() => {
    if (!hasSelectedCustomer) return null;
    return customerLocations.find((location) => location.id === customerId) ?? null;
  }, [customerLocations, hasSelectedCustomer, customerId]);

  const selectedCustomerStatus = hasSelectedCustomer
    ? collectedCustomerIds.includes(customerId)
      ? "collected"
      : "not_collected"
    : null;
  const selectedCustomerStatusLabel = selectedCustomerStatus
    ? selectedCustomerStatus === "collected"
      ? t("common.collected")
      : t("common.not_collected")
    : null;
  const formatCoordinate = (value?: number | null) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(5)
      : t("common.not_available");

  const focusedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === focusedVehicleId) ?? null,
    [vehicles, focusedVehicleId]
  );

  const focusedVehicleStatusClass = focusedVehicle
    ? focusedVehicle.status.toLowerCase().replace(" ", "-")
    : "";

  // Fetch vehicle data from Vamosys
  const fetchVamosysData = useCallback(async () => {
    try {
      const response = await fetch(
        "https://api.vamosys.com/mobile/getGrpDataForTrustedClients?providerName=BLUEPLANET&fcode=VAM",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log(response);
      

      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      console.log("Raw API data:", data);

      const parsedData: Vehicle[] =
        data?.data?.map((v: any, index: number) => {
          const number =
            v.vehicleNumber || v.vehicleNo || v.vehicle_number || v.regNo || t("common.unknown");
          const resolvedId =
            number && number !== "Unknown" ? String(number) : String(index);
          return {
            id: resolvedId,
            number,
            lat: parseFloat(v.latitude) || 28.61,
            lon: parseFloat(v.longitude) || 77.23,
            status: v.status || "Idle",
            speed: v.speed || 0,
            ignition: v.ignitionStatus === "ON",
            location: v.location || t("common.location_unavailable"),
            distance: v.distance || 0,
            updatedAt: v.updatedAt || new Date().toISOString(),
          };
        }) || [];

      setVehicles(parsedData);
    } catch (error) {
      console.error("Error fetching vehicle data:", error);
    }
  }, [t]);

  

  // Load vehicle data once
  useEffect(() => {
    fetchVamosysData();
  }, [fetchVamosysData]);

  const fetchSummaryCounts = useCallback(async () => {
    let households = 0;
    let customerData: CustomerRecord[] = [];
    const resolveId = (c: any) => String(c?.unique_id ?? c?.id ?? "");

    try {
      const response = await customerCreationApi.readAll();
      const normalized = normalizeCustomerArray(response) as CustomerRecord[];
      const activeCustomers = filterActiveCustomers(normalized) as CustomerRecord[];
      households = activeCustomers.length;
      customerData = activeCustomers;
    } catch (error) {
      console.error("Failed to fetch household summary:", error);
    }

    const locations = customerData.reduce<CustomerLocation[]>((acc, customer) => {
      const lat = pickCoordinate(customer, [
        "latitude",
        "lat",
        "latitude_value",
        "latitudeValue",
      ]);
      const lon = pickCoordinate(customer, [
        "longitude",
        "lng",
        "lon",
        "longitude_value",
        "longitudeValue",
      ]);
      if (lat === null || lon === null) return acc;
      const id = resolveId(customer);
      if (!id) return acc;
      acc.push({
        id,
        name: customer.customer_name ?? t("common.unknown"),
        lat,
        lon,
        address: `${customer.building_no || ""} ${customer.street || ""} ${customer.area || ""}`.trim(),
        zone: customer.zone_name,
        ward: customer.ward_name,
      });
      return acc;
    }, []);

    setCustomerLocations(locations);
    setTotalHouseholdCount(households);
    setAllCustomers(customerData);

    let collectedIds: string[] = [];
    try {
      const params: Record<string, string> = {};
      if (fromDate) {
        params.collection_date = fromDate;
      }
      const response = await wasteCollectionApi.readAll({ params });
      if (Array.isArray(response)) {
        collectedIds = Array.from(
          new Set(
            response
              .map((entry: any) =>
                String(
                  entry.customer ??
                  entry.customer_id ??
                  entry.customer_unique_id ??
                  ""
                )
              )
              .filter((id: string) => id.trim())
          )
        );
      }
    } catch (error) {
      console.error("Failed to fetch waste collection summary:", error);
    }

    setCollectedCustomerIds(collectedIds);
    setCollectedCount(collectedIds.length);
    setNotCollectedCount(Math.max(households - collectedIds.length, 0));
  }, [fromDate, t]);

  useEffect(() => {
    fetchSummaryCounts();
  }, [fetchSummaryCounts]);

  useEffect(() => {
    if (!datepickerRef.current) return;
    fpInstance.current = flatpickr(datepickerRef.current, {
      dateFormat: "Y-m-d",
      maxDate: "today",
      defaultDate: new Date(fromDate),
      allowInput: true,
      onChange: (selectedDates) => {
        if (selectedDates.length) {
          setFromDate(
            selectedDates[0].toISOString().split("T")[0]
          );
        }
      },
    });
    return () => {
      fpInstance.current?.destroy();
      fpInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!fpInstance.current) return;
    if (!fromDate) return;
    const targetDate = new Date(`${fromDate}T00:00:00`);
    const current = fpInstance.current.selectedDates[0];
    if (
      !current ||
      current.toISOString().split("T")[0] !== fromDate
    ) {
      fpInstance.current.setDate(targetDate, false);
    }
  }, [fromDate]);

  // Initialize map
  useEffect(() => {
    const leafletMap = L.map("map", { center: [28.6, 77.2], zoom: 8 });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(leafletMap);

    setMap(leafletMap);

    return () => {
      leafletMap.remove();
    };
  }, []);

  // Add truck markers
  useEffect(() => {
    if (!map) return;
    const vehicleLayer = L.layerGroup();

    vehicleMarkerLookupRef.current = {};
    vehicles.forEach((v) => {
      const isFocused = v.id === focusedVehicleId;
      const marker = L.marker([v.lat, v.lon], {
        icon: createTruckIcon(v.status, isFocused),
      })
        .addTo(vehicleLayer)
        .bindPopup(
          `<b>${v.number}</b><br>${t("dashboard.live_map.popup_status")}: ${getVehicleStatusLabel(
            v.status
          )}<br>${t("dashboard.live_map.popup_speed")}: ${v.speed} ${t(
            "dashboard.live_map.units.kmh"
          )}<br>${v.location}`
        );
      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());
      marker.on("click", () => {
        setFocusedVehicleId(v.id);
        setPanelOpen(true);
      });
      vehicleMarkerLookupRef.current[v.id] = marker;
    });

    vehicleLayer.addTo(map);
    return () => {
      vehicleLayer.remove();
    };
  }, [map, vehicles, focusedVehicleId]);

  useEffect(() => {
    if (!map || !focusedVehicleId) return;
    const target = vehicles.find((v) => v.id === focusedVehicleId);
    if (!target) return;
    const marker = vehicleMarkerLookupRef.current[focusedVehicleId];
    if (marker) {
      marker.openPopup();
    }
    const currentZoom = map.getZoom();
    map.setView([target.lat, target.lon], Math.max(currentZoom, 15), {
      animate: true,
    });
  }, [map, focusedVehicleId, vehicles]);

  useEffect(() => {
    if (!map) return;
    const dataLayer = L.layerGroup();
    const selectedLocations =
      selectedStatus === "collected"
        ? collectedCustomerLocations
        : selectedStatus === "not_collected"
        ? notCollectedCustomerLocations
        : customerLocations;

    const color =
      selectedStatus === "collected"
        ? "#16a34a"
        : selectedStatus === "not_collected"
        ? "#dc2626"
        : "#2563eb";

    selectedLocations.forEach((location) => {
      const isFocused = selectedCustomerLocation?.id === location.id;
      const marker = L.marker([location.lat, location.lon], {
        icon: createHouseIcon(color, isFocused),
      })
        .addTo(dataLayer)
        .bindPopup(
          `<strong>${location.name}</strong><br>${location.address}<br>${location.zone || ""} ${
            location.ward || ""
          }`
        );
      marker.on("mouseover", () => marker.openPopup());
      marker.on("mouseout", () => marker.closePopup());
      marker.on("click", () => {
        setCustomerId(location.id);
        setPanelOpen(true);
      });
    });

    dataLayer.addTo(map);
    return () => {
      dataLayer.remove();
    };
  }, [
    map,
    selectedStatus,
    customerLocations,
    collectedCustomerLocations,
    notCollectedCustomerLocations,
    selectedCustomerLocation,
  ]);

  useEffect(() => {
    if (!map) return;
    const highlightLayer = L.layerGroup();

    if (selectedCustomerLocation) {
      const highlightColor =
        selectedCustomerStatus === "collected" ? "#16a34a" : "#dc2626";

      L.circleMarker([selectedCustomerLocation.lat, selectedCustomerLocation.lon], {
        radius: 10,
        color: highlightColor,
        fillColor: highlightColor,
        fillOpacity: 0.4,
        weight: 2,
      })
        .addTo(highlightLayer)
        .bindPopup(
          `<strong>${selectedCustomerLocation.name}</strong><br>${selectedCustomerLocation.address}`
        )
        .openPopup();

      map.setView([selectedCustomerLocation.lat, selectedCustomerLocation.lon], 15);
    }

    highlightLayer.addTo(map);
    return () => {
      highlightLayer.remove();
    };
  }, [map, selectedCustomerLocation, selectedCustomerStatusLabel, selectedCustomerStatus]);


  return (
    <div className="space-y-3">
     
        <div className="flex justify-between items-center border-b pb-2">
          <h5 className="text-lg font-semibold flex items-center">
            {t("admin.collection_monitoring.title")}
          </h5>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-2">
          {showField("date") && (
          <div>
            <label className="block text-sm font-medium mb-1">{t("common.date")}</label>
            <input
              ref={datepickerRef}
              type="text"
              className="form-input w-full border rounded-md p-2"
              value={fromDate}
              readOnly
            />
          </div>
          )}

          {showField("zone") && (
          <div>
            <label className="block text-sm font-medium mb-1">{t("common.zone")}</label>
            <select
              className="form-select w-full border rounded-md p-2"
              value={zone}
              onChange={(e) => {
                setZone(e.target.value);
                setWard("");
                setCustomerId("");
              }}
            >
              <option value="">
                {t("common.select_item_placeholder", { item: t("common.zone") })}
              </option>
              {zoneOptions.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>
          )}
          {showField("ward") && (
          <div>
            <label className="block text-sm font-medium mb-1">{t("common.ward")}</label>
            <select
              className="form-select w-full border rounded-md p-2"
              value={ward}
              onChange={(e) => {
                setWard(e.target.value);
                setCustomerId("");
              }}
            >
              <option value="">
                {t("common.select_item_placeholder", { item: t("common.ward") })}
              </option>
              {wardOptions.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
          )}

          {showField("customer") && (
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("common.customer")}
            </label>
            <select
              className="form-select w-full border rounded-md p-2"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">
                {t("common.select_item_placeholder", { item: t("common.customer") })}
              </option>
              {customerOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchSummaryCounts}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              {t("common.go")}
            </button>
          </div>
        </div>

        <hr className="my-4" />
        <div className="mb-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surfaceAlt)]/80 px-4 py-3 text-sm">
          {selectedCustomerLocation ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              {(showField("customer") || showField("address")) && (
              <div>
                {showField("customer") && (
                <>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-mutedText)]">
                  {t("common.customer")}
                </div>
                <div className="text-base font-semibold text-[var(--admin-text)]">
                  {selectedCustomerLocation.name}
                </div>
                </>
                )}
                {showField("address") && (
                <div className="text-xs text-[var(--admin-mutedText)]">
                  {selectedCustomerLocation.address || t("common.not_available")}
                </div>
                )}
              </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--admin-text)]">
                {showField("zone") && (
                <span>
                  <span className="text-[var(--admin-mutedText)]">
                    {t("common.zone")}:
                  </span>{" "}
                  {selectedCustomerLocation.zone || t("common.not_available")}
                </span>
                )}
                {showField("ward") && (
                <span>
                  <span className="text-[var(--admin-mutedText)]">
                    {t("common.ward")}:
                  </span>{" "}
                  {selectedCustomerLocation.ward || t("common.not_available")}
                </span>
                )}
                {showField("collection_status") && selectedCustomerStatusLabel && (
                  <span className="rounded-full bg-[var(--admin-accentSoft)] px-3 py-1 text-[var(--admin-accent)]">
                    {selectedCustomerStatusLabel}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-[var(--admin-mutedText)]">
              {t("admin.collection_monitoring.select_customer_hint")}
            </span>
          )}
        </div>

        {/* Map */}
        <div
          className="map-wrapper"
          style={{ height: "calc(100vh - 320px)", width: "100%" }}
        >
          <div id="map" className="map-canvas"></div>
          <div className={`admin-map-panel ${panelOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="admin-map-panel__toggle"
              onClick={() => setPanelOpen((prev) => !prev)}
            >
              {panelOpen ? "<" : ">"}
            </button>
            <button
              type="button"
              className="admin-map-panel__close"
              onClick={() => setPanelOpen(false)}
            >
              x
            </button>
            <div className="admin-map-panel__content">
              <div className="admin-map-panel__section">
                {showField("vehicle") && (
                <>
                <div className="admin-map-panel__section-title">
                  {t("common.vehicle")}
                </div>
                {focusedVehicle ? (
                  <>
                    <div className="admin-map-panel__header">
                      <div>
                        <div className="admin-map-panel__eyebrow">
                          {t("dashboard.live_map.labels.vehicle")}
                        </div>
                        <div className="admin-map-panel__title">
                          {focusedVehicle.number}
                        </div>
                      </div>
                      <span
                        className={`admin-map-panel__status status-${focusedVehicleStatusClass}`}
                      >
                        {getVehicleStatusLabel(focusedVehicle.status)}
                      </span>
                    </div>
                    {showField("speed") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("dashboard.live_map.labels.speed")}
                      </span>
                      <span className="admin-map-panel__value">
                        {Number(focusedVehicle.speed).toFixed(1)}{" "}
                        {t("dashboard.live_map.units.kmh")}
                      </span>
                    </div>
                    )}
                    {showField("ignition") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("admin.vehicle_tracking.labels.ignition")}
                      </span>
                      <span className="admin-map-panel__value">
                        {focusedVehicle.ignition ? "ON" : "OFF"}
                      </span>
                    </div>
                    )}
                    {showField("distance") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("admin.vehicle_tracking.labels.distance")}
                      </span>
                      <span className="admin-map-panel__value">
                        {Number(focusedVehicle.distance).toFixed(1)} km
                      </span>
                    </div>
                    )}
                    {showField("location") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("dashboard.live_map.labels.location")}
                      </span>
                      <span className="admin-map-panel__value">
                        {focusedVehicle.location || t("common.location_unavailable")}
                      </span>
                    </div>
                    )}
                    {showField("updated_at") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("admin.vehicle_tracking.labels.updated")}
                      </span>
                      <span className="admin-map-panel__value">
                        {focusedVehicle.updatedAt}
                      </span>
                    </div>
                    )}
                  </>
                ) : (
                  <div className="admin-map-panel__empty">
                    {t("dashboard.live_map.select_vehicle")}
                  </div>
                )}
                </>
                )}
              </div>

              <div className="admin-map-panel__divider" />

              <div className="admin-map-panel__section">
                {(showField("customer") ||
                  showField("address") ||
                  showField("zone") ||
                  showField("ward") ||
                  showField("latitude") ||
                  showField("longitude")) && (
                <>
                <div className="admin-map-panel__section-title">
                  {t("common.customer")}
                </div>
                {selectedCustomerLocation ? (
                  <>
                    <div className="admin-map-panel__header">
                      {showField("customer") && (
                      <div className="admin-map-panel__title-row">
                        <span className="admin-map-panel__icon admin-map-panel__icon--house" aria-hidden="true">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M3 11.4L12 4l9 7.4M6 10.8V20h12v-9.2M9.5 20v-5h5v5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <div>
                          <div className="admin-map-panel__eyebrow">
                            {t("common.customer")}
                          </div>
                          <div className="admin-map-panel__title">
                            {selectedCustomerLocation.name}
                          </div>
                        </div>
                      </div>
                      )}
                      {showField("collection_status") && (
                      <span className="admin-map-panel__status">
                        {selectedCustomerStatusLabel}
                      </span>
                      )}
                    </div>
                    {showField("address") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("common.address")}
                      </span>
                      <span className="admin-map-panel__value">
                        {selectedCustomerLocation.address || t("common.not_available")}
                      </span>
                    </div>
                    )}
                    {showField("zone") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("common.zone")}
                      </span>
                      <span className="admin-map-panel__value">
                        {selectedCustomerLocation.zone || t("common.not_available")}
                      </span>
                    </div>
                    )}
                    {showField("ward") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("common.ward")}
                      </span>
                      <span className="admin-map-panel__value">
                        {selectedCustomerLocation.ward || t("common.not_available")}
                      </span>
                    </div>
                    )}
                    {showField("latitude") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("common.latitude")}
                      </span>
                      <span className="admin-map-panel__value">
                        {formatCoordinate(selectedCustomerLocation.lat)}
                      </span>
                    </div>
                    )}
                    {showField("longitude") && (
                    <div className="admin-map-panel__row">
                      <span className="admin-map-panel__label">
                        {t("common.longitude")}
                      </span>
                      <span className="admin-map-panel__value">
                        {formatCoordinate(selectedCustomerLocation.lon)}
                      </span>
                    </div>
                    )}
                  </>
                ) : (
                  <div className="admin-map-panel__empty">
                    {t("admin.collection_monitoring.select_customer_hint")}
                  </div>
                )}
                </>
                )}
              </div>
            </div>
          </div>
          {(showField("not_collected_count") ||
            showField("collected_count") ||
            showField("total_household_count")) && (
          <div className="map-household-summary">
            {statusOptions.filter((status) => {
              if (status.value === "not_collected") return showField("not_collected_count");
              if (status.value === "collected") return showField("collected_count");
              return showField("total_household_count");
            }).map((status) => {
              const isSelected = selectedStatus === status.value;
              return (
                <button
                  key={status.value}
                  type="button"
                  className={`summary-pill ${status.value} ${
                    isSelected ? "is-active" : ""
                  }`}
                  onClick={() => setSelectedStatus(status.value)}
                >
                  <span className="summary-dot" />
                  {status.label}: {status.count}
                </button>
              );
            })}
          </div>
          )}
          <div className="map-status-badge">
            {selectedCustomerLocation ? (
              <>
                {showField("customer") && (
                <span className="map-status-badge__title">
                  {selectedCustomerLocation.name}
                </span>
                )}
                {showField("collection_status") && (
                <span
                  className={`map-status-pill ${
                    selectedCustomerStatus === "collected"
                      ? "collected"
                      : "not-collected"
                  }`}
                >
                  {selectedCustomerStatusLabel}
                </span>
                )}
              </>
            ) : (
              <span className="map-status-badge__hint">
                {t("admin.collection_monitoring.select_customer_hint")}
              </span>
            )}
          </div>
        </div>
     
    </div>
  );
};

export default WasteCollectionMonitor;
