import { complaintApi } from "@/helpers/admin";
import type { Grievance } from "./types";

export async function fetchGrievances(signal?: AbortSignal) {
  const data = await complaintApi.readAll({ signal });
  return data as Grievance[];
}


