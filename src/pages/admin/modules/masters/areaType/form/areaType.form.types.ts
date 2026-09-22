import type { GeoCoordinateDraft } from "../../shared/GeoFenceCoordinates";

export type Option = {
  value: string;
  label: string;
  stateId?: string;
};

export type RecordRow = Record<string, any>;

export type AreaTypeInitialPayload = {
  name: string;
  state_id: string;
  district_id: string;
  coordinates: GeoCoordinateDraft[];
  is_active: boolean;
};

/** The final shape sent to the API — coordinates are already serialized as plain numbers. */
export type AreaTypePayload = {
  name: string;
  state_id: string;
  district_id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  is_active: boolean;
};

/** The camelCase shape produced by the fields form, before API serialization. */
export type AreaTypeFieldsSubmitPayload = {
  name: string;
  stateId: string;
  districtId: string;
  coordinates: GeoCoordinateDraft[];
  isActive: boolean;
};
