import { z } from "zod";

import { optionalString, requiredString } from "@/schemas/shared/fields";

/**
 * `TicketWizardForm` (complaintManagement/tickets) only ever blocked
 * submission on category, priority, status and title — mirrored here as the
 * only required fields. Every other field (customer, phone, profile name,
 * source, language, waste types, subcategory, description, and the whole
 * location step) was optional in the old manual check and stays optional.
 */
export const ticketSchema = z.object({
  customer: optionalString,
  wa_phone: optionalString,
  profile_name: optionalString,
  source: optionalString,
  language: optionalString,
  category: requiredString("Category"),
  waste_types: z.array(z.string()),
  subcategory: optionalString,
  priority: requiredString("Priority"),
  status: requiredString("Status"),
  title: requiredString("Title"),
  description: optionalString,
  location_text: optionalString,
  latitude: optionalString,
  longitude: optionalString,
  state: optionalString,
  district: optionalString,
  area_type: optionalString,
  city: optionalString,
  city_type: optionalString,
});

export type TicketFormValues = z.infer<typeof ticketSchema>;
