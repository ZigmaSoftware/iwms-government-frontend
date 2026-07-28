import { adminApi } from "@/helpers/admin/registry";
import { api } from "@/api";
import {
  mergeWithScopeOptionExtra,
  type ScopeLevel,
} from "../../pages/admin/modules/masters/shared/dataScopeOptions";
import type {
  AssignableStaffResponse,
  ComplaintCategory,
  ComplaintFeedback,
  ComplaintLanguage,
  ComplaintModule,
  ComplaintNotification,
  ComplaintPriority,
  ComplaintSource,
  ComplaintStatus,
  ComplaintSubcategory,
  ComplaintTeam,
  ComplaintSlaRule,
  ComplaintTicket,
  GeoOption,
  Grievance,
  LocalBodyOption,
  LocalBodyType,
  PublicGrievanceLocationOption,
  PublicGrievanceMeta,
  PublicGrievanceResponse,
  PublicGrievanceStatusResult,
} from "./types";

export const complaintTicketApi = adminApi.complaintTickets as typeof adminApi.complaintTickets;
export const complaintModuleApi = adminApi.complaintModules as typeof adminApi.complaintModules;
export const complaintCategoryApi = adminApi.complaintCategories as typeof adminApi.complaintCategories;
export const complaintSubcategoryApi = adminApi.complaintSubcategories as typeof adminApi.complaintSubcategories;
export const complaintPriorityApi = adminApi.complaintPriorities as typeof adminApi.complaintPriorities;
export const complaintStatusApi = adminApi.complaintStatuses as typeof adminApi.complaintStatuses;
export const complaintSourceApi = adminApi.complaintSources as typeof adminApi.complaintSources;
export const complaintLanguageApi = adminApi.complaintLanguages as typeof adminApi.complaintLanguages;
export const complaintTeamApi = adminApi.complaintTeams as typeof adminApi.complaintTeams;
export const complaintSlaRuleApi = adminApi.complaintSlaRules as typeof adminApi.complaintSlaRules;
export const complaintFeedbackApi = adminApi.complaintFeedback as typeof adminApi.complaintFeedback;
export const complaintNotificationApi = adminApi.complaintNotifications as typeof adminApi.complaintNotifications;

export const complaintTicketingApi = {
  tickets: complaintTicketApi,
  modules: complaintModuleApi,
  categories: complaintCategoryApi,
  subcategories: complaintSubcategoryApi,
  priorities: complaintPriorityApi,
  statuses: complaintStatusApi,
  sources: complaintSourceApi,
  languages: complaintLanguageApi,
  teams: complaintTeamApi,
  slaRules: complaintSlaRuleApi,
  feedback: complaintFeedbackApi,
};

export type {
  ComplaintCategory,
  ComplaintFeedback,
  ComplaintLanguage,
  ComplaintModule,
  ComplaintPriority,
  ComplaintSource,
  ComplaintStatus,
  ComplaintSubcategory,
  ComplaintSlaRule,
  ComplaintTeam,
  ComplaintTicket,
};

export const ticketActions = {
  changeStatus: (id: string, payload: { status_code: string; remarks?: string }) =>
    complaintTicketApi.action<ComplaintTicket>(`${id}/status`, payload),
  assign: (id: string, payload: { team?: string; staff?: string; reason?: string }) =>
    complaintTicketApi.action<ComplaintTicket>(`${id}/assign`, payload),
  resolve: (id: string, payload: { resolution_note?: string; remarks?: string }) =>
    complaintTicketApi.action<ComplaintTicket>(`${id}/resolve`, payload),
  escalate: (id: string, payload: { team?: string; reason?: string }) =>
    complaintTicketApi.action<ComplaintTicket>(`${id}/escalate`, payload),
  comment: (id: string, payload: { comment_text: string; is_internal?: boolean; is_sensitive?: boolean }) =>
    complaintTicketApi.action(`${id}/comments`, payload),
  reopen: (id: string, payload: { reopen_reason?: string }) =>
    complaintTicketApi.action<ComplaintTicket>(`${id}/reopen`, payload),
  feedback: (id: string, payload: { rating?: number; feedback_text?: string; is_issue_solved?: boolean }) =>
    complaintTicketApi.action(`${id}/feedback`, payload),
  attach: (id: string, payload: FormData) =>
    complaintTicketApi.action(`${id}/attachments`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  assignableStaff: (id: string, params?: { district?: string; city?: string; department?: string }) =>
    complaintTicketApi.action<AssignableStaffResponse>(`${id}/assignable-staff`, undefined, { params }),
};

/* -----------------------------------------
   State / District / City (local body) lookups built on the flat geo
   masters - the same State -> District cascade the other admin forms use.
----------------------------------------- */
const asRows = <T = any>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : ((value as any)?.results ?? (value as any)?.data ?? []);

const entityId = (value: unknown): string => {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.unique_id ?? record.id ?? "");
  }
  return value == null ? "" : String(value);
};

const LOCAL_BODY_SOURCES: { api: typeof adminApi.corporations; type: LocalBodyType; nameKeys: string[] }[] = [
  { api: adminApi.corporations, type: "corporation", nameKeys: ["corporation_name"] },
  { api: adminApi.municipalities, type: "municipality", nameKeys: ["municipality_name"] },
  { api: adminApi.townPanchayats, type: "town_panchayat", nameKeys: ["town_panchayat_name"] },
  { api: adminApi.panchayatUnions, type: "panchayat_union", nameKeys: ["union_name", "panchayat_union_name"] },
  { api: adminApi.panchayats, type: "panchayat", nameKeys: ["panchayat_name"] },
];

/**
 * Merge a permission-gated geo fetch result with the logged-in user's Data
 * Scope fallback for `level`, so callers always see at least their own
 * scoped value even when the underlying master's screen isn't
 * permission-granted to them (403/empty fetch). Adapts between the flat
 * GeoOption/LocalBodyOption shape (unique_id/name, plus any extra fields)
 * used throughout complaint ticketing and the shared ScopeOption shape
 * (value/label) the masters' Data Scope helper works with — the return
 * shape is unchanged from what callers already receive.
 */
const mergeGeoWithScope = <T extends { unique_id: string; name: string }>(
  fetched: T[],
  level: ScopeLevel,
  extra: Record<string, unknown> = {},
): T[] => {
  const scopeShaped = fetched.map(({ unique_id, name, ...rest }) => ({
    value: unique_id,
    label: name,
    ...rest,
  }));
  const merged = mergeWithScopeOptionExtra(
    scopeShaped,
    level,
    extra as Partial<Omit<(typeof scopeShaped)[number], "value" | "label">>,
  );
  return merged.map(({ value, label, ...rest }) => ({
    unique_id: value,
    name: label,
    ...rest,
  })) as unknown as T[];
};

export const geoApi = {
  states: async (): Promise<GeoOption[]> => {
    const rows = await adminApi.states.readAll();
    const fetched = asRows(rows).map((row: any) => ({
      unique_id: String(row.unique_id),
      name: row.name ?? row.state_name ?? String(row.unique_id),
    }));
    return mergeGeoWithScope(fetched, "state");
  },
  districts: async (stateId?: string): Promise<GeoOption[]> => {
    const rows = await adminApi.districts.readAll();
    const fetched = asRows(rows)
      .map((row: any) => ({
        unique_id: String(row.unique_id),
        name: row.name ?? row.district_name ?? String(row.unique_id),
        state_id: entityId(row.state_id ?? row.state),
      }))
      .filter((row) => !stateId || row.state_id === stateId);
    return mergeGeoWithScope(fetched, "district", stateId ? { state_id: stateId } : {});
  },
  areaTypes: async (districtId?: string): Promise<GeoOption[]> => {
    const rows = await adminApi.areatypes.readAll();
    const fetched = asRows(rows)
      .map((row: any) => ({
        unique_id: String(row.unique_id),
        name: row.name ?? row.area_type_name ?? String(row.unique_id),
        district_id: entityId(row.district_id ?? row.district),
      }))
      .filter((row) => !districtId || !row.district_id || row.district_id === districtId);
    return mergeGeoWithScope(fetched, "area_type", districtId ? { district_id: districtId } : {});
  },
  localBodies: async (
    districtId: string,
    areaTypeId?: string,
    localBodyType?: LocalBodyType | "",
  ): Promise<LocalBodyOption[]> => {
    const sources = localBodyType
      ? LOCAL_BODY_SOURCES.filter((source) => source.type === localBodyType)
      : LOCAL_BODY_SOURCES;
    const lists = await Promise.all(
      sources.map((source) => source.api.readAll().catch(() => [])),
    );
    const options: LocalBodyOption[] = [];
    sources.forEach((source, index) => {
      asRows(lists[index]).forEach((row: any) => {
        if (entityId(row.district_id ?? row.district) !== districtId) return;
        const rowAreaTypeId = entityId(row.area_type_id ?? row.area_type);
        if (areaTypeId && rowAreaTypeId && rowAreaTypeId !== areaTypeId) return;
        const name = source.nameKeys.map((key) => row[key]).find(Boolean) ?? row.name;
        options.push({
          unique_id: String(row.unique_id),
          name: name ?? String(row.unique_id),
          type: source.type,
          district_id: districtId,
          area_type_id: rowAreaTypeId,
        });
      });
    });
    // Each local-body type's own screen may not be permission-granted to
    // this user (View gates that level's own menu/list, not this dropdown)
    // — fall back to the user's Data Scope value for every local-body level,
    // so their own local body is always selectable regardless. Merged in
    // per-type so each fallback carries the correct `type` discriminator.
    const merged = sources.reduce((acc, source) => {
      return mergeGeoWithScope(acc, source.type as ScopeLevel, { type: source.type });
    }, options);
    return merged.sort((a, b) => a.name.localeCompare(b.name));
  },
};

/* -----------------------------------------
   Notifications feed for the logged-in staff/user
----------------------------------------- */
export const notificationActions = {
  list: (config?: { signal?: AbortSignal }) =>
    complaintNotificationApi.readAll(config) as Promise<ComplaintNotification[]>,
  unreadCount: () =>
    complaintNotificationApi.action<{ unread_count: number }>("unread-count"),
  markRead: (id: string) =>
    complaintNotificationApi.action<ComplaintNotification>(`${id}/read`, {}),
  markAllRead: () =>
    complaintNotificationApi.action<{ updated: number }>("mark-all-read", {}),
};

export async function fetchGrievances(signal?: AbortSignal) {
  const data = await complaintTicketApi.readAllForExport({ signal });
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown })?.results)
      ? (data as { results: unknown[] }).results
      : [];
  return (rows as ComplaintTicket[]).map((ticket, index): Grievance => ({
    id: index,
    unique_id: ticket.ticket_no || ticket.unique_id,
    title: ticket.title || ticket.category_name || "Complaint",
    category: ticket.category_name || "",
    main_category: ticket.category_name || "",
    sub_category: ticket.subcategory_name || "",
    category_name: ticket.category_name || "",
    subcategory_name: ticket.subcategory_name || "",
    description: ticket.description || "",
    details: ticket.description || "",
    status: (ticket.status_code || ticket.status_name || "").toLowerCase().replaceAll("_", "-"),
    status_code: ticket.status_code || "",
    status_name: ticket.status_name || "",
    created: ticket.created,
    complaint_closed_at: ticket.closed_at ?? undefined,
    closed_at: ticket.closed_at ?? undefined,
    contact_no: ticket.wa_phone || "",
    wa_phone: ticket.wa_phone || "",
    customer_id: ticket.customer ? String(ticket.customer) : "",
    customer_name: ticket.customer_name || "",
    profile_name: ticket.profile_name || "",
    reporter_type: ticket.reporter_type || (ticket.customer ? "Customer" : "Public Grievance"),
    reporter_name: ticket.reporter_name || ticket.customer_name || ticket.profile_name || "Anonymous",
    raised_by_name: ticket.raised_by_name || ticket.customer_name || ticket.profile_name || "Anonymous",
    email: ticket.email || "",
    gender: ticket.gender || "",
    address: ticket.location_text || "",
    location_text: ticket.location_text || "",
    image_url: ticket.image_url || undefined,
    close_image_url: ticket.close_image_url || undefined,
    zone_id: String(ticket.district_id || ""),
    zone_name: ticket.district_name || ticket.city_name || "",
    ward_name: ticket.city_name || "",
    priority: ticket.priority_code || "",
    priority_code: ticket.priority_code || "",
    source_code: ticket.source_code || "",
    module_name: ticket.module_name || "",
    waste_type_names: ticket.waste_type_names || [],
    state_name: ticket.state_name || "",
    area_type_name: ticket.area_type_name || "",
    latitude: ticket.latitude ?? undefined,
    longitude: ticket.longitude ?? undefined,
    assigned_team_name: ticket.assigned_team_name || "",
    assigned_staff_name: ticket.assigned_staff_name || "",
    district_name: ticket.district_name || "",
    city_name: ticket.city_name || "",
    operational_context: ticket.operational_context,
  }));
}

export const publicGrievanceApi = {
  meta: async (signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceMeta>("/publicgrievance/meta/", {
      signal,
    });
    return data;
  },
  states: async (signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceLocationOption[]>("/publicgrievance/states/", { signal });
    return data;
  },
  districts: async (stateId?: string, signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceLocationOption[]>("/publicgrievance/districts/", {
      params: stateId ? { state: stateId } : undefined,
      signal,
    });
    return data;
  },
  cities: async (districtId: string, signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceLocationOption[]>("/publicgrievance/cities/", {
      params: { district: districtId },
      signal,
    });
    return data;
  },
  create: async (payload: FormData) => {
    const { data } = await api.post<PublicGrievanceResponse>("/publicgrievance/", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  status: async (params: { ticket_no?: string; mobile?: string }, signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceStatusResult[]>("/publicgrievance/status/", {
      params,
      signal,
    });
    return data;
  },
};
