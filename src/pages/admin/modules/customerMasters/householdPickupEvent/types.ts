export type SelectOption = { value: string; label: string };

export type HouseholdPickupFormState = {
  customer_id: string;
  zone_id: string;
  property_id: string;
  sub_property_id: string;
  pickup_time: string;
  weight_kg: string;
  collector_staff_id: string;
  vehicle_id: string;
  source: string;
};

export type HouseholdPickupEventRecord = {
  id: number;
  customer_id: string;
  zone_id: string;
  property_id: string;
  sub_property_id: string;
  pickup_time: string;
  weight_kg?: number | null;
  collector_staff_id: string;
  vehicle_id: string;
  source: string;
  created_at?: string | null;
};
