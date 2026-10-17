import type { LocalBodyType } from "@/features/complaintTicketing/types";

/** Value of the ticket location filter (see TicketLocationFilters). */
export type TicketLocationFilterValue = {
  state: string;
  district: string;
  areaType: string;
  localBodyType: LocalBodyType | "";
  city: string;
};

export const emptyTicketLocationFilter: TicketLocationFilterValue = {
  state: "",
  district: "",
  areaType: "",
  localBodyType: "",
  city: "",
};

/** Ticket list query params for a filter value. `localBodyType` only
 *  narrows the local-body dropdown, it is not a backend filter. */
export const ticketLocationParams = (value: TicketLocationFilterValue) => ({
  ...(value.state ? { state: value.state } : {}),
  ...(value.district ? { district: value.district } : {}),
  ...(value.areaType ? { area_type: value.areaType } : {}),
  ...(value.city ? { city: value.city } : {}),
});
