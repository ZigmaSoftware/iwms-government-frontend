/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { collectionPointApi, panchayatApi, wardApi, zoneApi } from "@/helpers/admin";
import { normalizeList } from "@/utils/forms";

export type LocationOption = { value: string; label: string };

type ApiItem = Record<string, unknown>;

const idOf = (item: ApiItem) => String(item.unique_id ?? item.id ?? "");
const optionsOf = (items: ApiItem[], labelKey: string): LocationOption[] =>
  items
    .map((item) => ({ value: idOf(item), label: String(item[labelKey] ?? idOf(item)) }))
    .filter((item) => item.value);

export function useCollectionPointLocationOptions(companyId: string, projectId: string) {
  const [zoneId, setZoneId] = useState("");
  const [wardId, setWardId] = useState("");
  const [panchayatId, setPanchayatId] = useState("");
  const [zones, setZones] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const [panchayats, setPanchayats] = useState<LocationOption[]>([]);
  const [collectionPointRecords, setCollectionPointRecords] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(false);

  const baseParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (companyId) params.company_id = companyId;
    if (projectId) params.project_id = projectId;
    return params;
  }, [companyId, projectId]);

  useEffect(() => {
    setZoneId("");
    setWardId("");
    setPanchayatId("");
    if (!companyId || !projectId) {
      setZones([]);
      setPanchayats([]);
      return;
    }
    Promise.all([
      zoneApi.readAll({ params: baseParams }),
      panchayatApi.readAll({ params: baseParams }),
    ]).then(([zoneResult, panchayatResult]) => {
      setZones(optionsOf(normalizeList(zoneResult) as ApiItem[], "zone_name"));
      setPanchayats(optionsOf(normalizeList(panchayatResult) as ApiItem[], "panchayat_name"));
    }).catch(() => {
      setZones([]);
      setPanchayats([]);
    });
  }, [baseParams, companyId, projectId]);

  useEffect(() => {
    setWardId("");
    if (!zoneId) {
      setWards([]);
      return;
    }
    wardApi.readAll({ params: { ...baseParams, zone_id: zoneId } })
      .then((result) => setWards(optionsOf(normalizeList(result) as ApiItem[], "ward_name")))
      .catch(() => setWards([]));
  }, [baseParams, zoneId]);

  useEffect(() => {
    if (!companyId || !projectId) {
      setCollectionPointRecords([]);
      return;
    }
    setLoading(true);
    const params = { ...baseParams } as Record<string, string>;
    // Collection points are urban (Ward/Zone) or rural (Panchayat), never both.
    if (panchayatId) params.panchayat_id = panchayatId;
    else if (wardId) params.ward_id = wardId;
    else if (zoneId) params.zone_id = zoneId;
    collectionPointApi.readAll({ params })
      .then((result) => setCollectionPointRecords(normalizeList(result) as ApiItem[]))
      .catch(() => setCollectionPointRecords([]))
      .finally(() => setLoading(false));
  }, [baseParams, companyId, panchayatId, projectId, wardId, zoneId]);

  return {
    zoneId,
    wardId,
    panchayatId,
    setZoneId: (value: string) => {
      setZoneId(value);
      setPanchayatId("");
    },
    setWardId: (value: string) => {
      setWardId(value);
      setPanchayatId("");
    },
    setPanchayatId: (value: string) => {
      setPanchayatId(value);
      if (value) {
        setZoneId("");
        setWardId("");
      }
    },
    zones,
    wards,
    panchayats,
    collectionPoints: optionsOf(collectionPointRecords, "cp_name"),
    loading,
  };
}
