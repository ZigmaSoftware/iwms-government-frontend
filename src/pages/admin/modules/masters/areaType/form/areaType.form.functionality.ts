import { adminApi } from "@/helpers/admin/registry";
import { stateApi, districtApi } from "@/helpers/admin";
import { mergeWithScopeOptionExtra, scopeOption } from "../../shared/dataScopeOptions";
import {
  normalizeCoordinateDrafts,
  serializeCoordinateDrafts,
} from "../../shared/GeoFenceCoordinates";
import { normalizeNullable, textOf, toRecordList } from "../../shared/recordHelpers";

import type {
  AreaTypeFieldsSubmitPayload,
  AreaTypeInitialPayload,
  AreaTypePayload,
  RecordRow,
} from "./areaType.form.types";

export const AREA_TYPE_FIELDS: Record<string, string[]> = {
  state_id: ["state_id"],
  district_id: ["district_id"],
  name: ["name"],
  coordinates: ["coordinates"],
  is_active: ["is_active"],
};

/** Loads the State/District dropdown options used by the form. */
export async function loadFormLookups() {
  const scopedStateId = scopeOption("state")?.value;
  const liteConfig = { params: { lite: 1 } };

  try {
    const [stateRes, districtRes] = await Promise.all([
      stateApi.readAll(liteConfig),
      districtApi.readAll(liteConfig),
    ]);

    const fetchedStates = toRecordList(stateRes)
      .map((row) => ({
        value: normalizeNullable(row.unique_id ?? row.id),
        label: textOf(row, "state_name", "name"),
      }))
      .filter((item) => item.value && item.label);
    const fetchedDistricts = toRecordList(districtRes)
      .map((row) => ({
        value: normalizeNullable(row.unique_id ?? row.id),
        label: textOf(row, "district_name", "name"),
        stateId: normalizeNullable(row.state_id ?? row.state),
      }))
      .filter((item) => item.value && item.label);

    return {
      states: mergeWithScopeOptionExtra(fetchedStates, "state", {}),
      districts: mergeWithScopeOptionExtra(
        fetchedDistricts,
        "district",
        scopedStateId ? { stateId: scopedStateId } : {},
      ),
    };
  } catch {
    return {
      states: mergeWithScopeOptionExtra(fetchedStatesEmpty(), "state", {}),
      districts: mergeWithScopeOptionExtra(
        fetchedDistrictsEmpty(),
        "district",
        scopedStateId ? { stateId: scopedStateId } : {},
      ),
    };
  }
}

// Typed empty arrays so mergeWithScopeOptionExtra's generic infers the same
// Option shape as the success path above, instead of `never[]`.
function fetchedStatesEmpty(): Array<{ value: string; label: string }> {
  return [];
}
function fetchedDistrictsEmpty(): Array<{ value: string; label: string; stateId: string }> {
  return [];
}

/** Loads one Area Type record for editing. */
export async function loadAreaTypeRecord(id: string): Promise<RecordRow> {
  return adminApi.areatypes.read(id);
}

export function toInitialPayload(recordData: RecordRow | null): AreaTypeInitialPayload {
  if (!recordData) {
    return {
      name: "",
      state_id: "",
      district_id: "",
      coordinates: normalizeCoordinateDrafts(null),
      is_active: true,
    };
  }
  return {
    name: textOf(recordData, "name", "area_type_name"),
    state_id: normalizeNullable(recordData.state_id ?? recordData.state),
    district_id: normalizeNullable(recordData.district_id ?? recordData.district),
    coordinates: normalizeCoordinateDrafts(recordData.coordinates),
    is_active: recordData.is_active !== false,
  };
}

export function toAreaTypePayload(input: AreaTypeFieldsSubmitPayload): AreaTypePayload {
  return {
    name: input.name.trim(),
    state_id: input.stateId,
    district_id: input.districtId,
    coordinates: serializeCoordinateDrafts(input.coordinates),
    is_active: input.isActive,
  };
}

/** Creates or updates an Area Type record. */
export async function submitAreaType(payload: AreaTypePayload, isEdit: boolean, id?: string) {
  if (isEdit && id) {
    await adminApi.areatypes.update(id, payload);
  } else {
    await adminApi.areatypes.create(payload);
  }
}
