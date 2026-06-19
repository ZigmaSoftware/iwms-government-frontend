/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { collectionPointApi, panchayatApi } from "@/helpers/admin";
import { normalizeList } from "@/utils/forms";

export type LocationOption = { value: string; label: string };

type ApiItem = Record<string, unknown>;

const idOf = (item: ApiItem) => String(item.unique_id ?? item.id ?? "");
const optionsOf = (items: ApiItem[], labelKey: string): LocationOption[] =>
  items
    .map((item) => ({ value: idOf(item), label: String(item[labelKey] ?? idOf(item)) }))
    .filter((item) => item.value);

export function useCollectionPointLocationOptions(companyId: string, projectId: string) {
  const [panchayatId, setPanchayatId] = useState("");
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
    setPanchayatId("");
    if (!companyId || !projectId) {
      setPanchayats([]);
      return;
    }
    panchayatApi.readAll({ params: baseParams })
      .then((panchayatResult) => {
      setPanchayats(optionsOf(normalizeList(panchayatResult) as ApiItem[], "panchayat_name"));
    }).catch(() => {
      setPanchayats([]);
    });
  }, [baseParams, companyId, projectId]);

  useEffect(() => {
    if (!companyId || !projectId) {
      setCollectionPointRecords([]);
      return;
    }
    setLoading(true);
    const params = { ...baseParams } as Record<string, string>;
    if (panchayatId) params.panchayat_id = panchayatId;
    collectionPointApi.readAll({ params })
      .then((result) => setCollectionPointRecords(normalizeList(result) as ApiItem[]))
      .catch(() => setCollectionPointRecords([]))
      .finally(() => setLoading(false));
  }, [baseParams, companyId, panchayatId, projectId]);

  return {
    panchayatId,
    setPanchayatId,
    panchayats,
    collectionPoints: optionsOf(collectionPointRecords, "cp_name"),
    loading,
  };
}
