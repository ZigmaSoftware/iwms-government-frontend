import { adminApi } from "@/helpers/admin/registry";
import { api } from "@/api";
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

export const geoApi = {
  states: async (): Promise<GeoOption[]> => {
    const rows = await adminApi.states.readAll();
    return asRows(rows).map((row: any) => ({
      unique_id: String(row.unique_id),
      name: row.name ?? row.state_name ?? String(row.unique_id),
    }));
  },
  districts: async (stateId?: string): Promise<GeoOption[]> => {
    const rows = await adminApi.districts.readAll();
    return asRows(rows)
      .map((row: any) => ({
        unique_id: String(row.unique_id),
        name: row.name ?? row.district_name ?? String(row.unique_id),
        state_id: entityId(row.state_id ?? row.state),
      }))
      .filter((row) => !stateId || row.state_id === stateId);
  },
  localBodies: async (districtId: string): Promise<LocalBodyOption[]> => {
    const lists = await Promise.all(
      LOCAL_BODY_SOURCES.map((source) => source.api.readAll().catch(() => [])),
    );
    const options: LocalBodyOption[] = [];
    LOCAL_BODY_SOURCES.forEach((source, index) => {
      asRows(lists[index]).forEach((row: any) => {
        if (entityId(row.district_id ?? row.district) !== districtId) return;
        const name = source.nameKeys.map((key) => row[key]).find(Boolean) ?? row.name;
        options.push({
          unique_id: String(row.unique_id),
          name: name ?? String(row.unique_id),
          type: source.type,
        });
      });
    });
    return options.sort((a, b) => a.name.localeCompare(b.name));
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
  const data = await complaintTicketApi.readAll({ signal });
  return data as Grievance[];
}

export const publicGrievanceApi = {
  meta: async (signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceMeta>("/publicgrivence/meta/", {
      signal,
    });
    return data;
  },
  states: async (signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceLocationOption[]>("/publicgrivence/states/", { signal });
    return data;
  },
  districts: async (stateId?: string, signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceLocationOption[]>("/publicgrivence/districts/", {
      params: stateId ? { state: stateId } : undefined,
      signal,
    });
    return data;
  },
  cities: async (districtId: string, signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceLocationOption[]>("/publicgrivence/cities/", {
      params: { district: districtId },
      signal,
    });
    return data;
  },
  create: async (payload: FormData) => {
    const { data } = await api.post<PublicGrievanceResponse>("/publicgrivence/", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  status: async (params: { ticket_no?: string; mobile?: string }, signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceStatusResult[]>("/publicgrivence/status/", {
      params,
      signal,
    });
    return data;
  },
};
