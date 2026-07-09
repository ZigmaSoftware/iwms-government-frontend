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
  Grievance,
  HierarchyNode,
  PublicGrievanceLocationNode,
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
export const hierarchyNodeApi = adminApi.hierarchyNodes as typeof adminApi.hierarchyNodes;
export const hierarchyLevelApi = adminApi.hierarchyLevels as typeof adminApi.hierarchyLevels;

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
  assignableStaff: (id: string, params?: { location_node?: string; department?: string }) =>
    complaintTicketApi.action<AssignableStaffResponse>(`${id}/assignable-staff`, undefined, { params }),
};

/* -----------------------------------------
   District / City lookups for the assign dropdown
   (built on the generic Hierarchy Tree masters API)
----------------------------------------- */
export const geoHierarchyApi = {
  districts: async () => {
    const levels = await hierarchyLevelApi.readAll({ params: { search: "District" } });
    const districtLevel = levels.find((lvl: any) => lvl.name === "District");
    if (!districtLevel) return [] as HierarchyNode[];
    return hierarchyNodeApi.readAll({ params: { level: districtLevel.unique_id } }) as Promise<HierarchyNode[]>;
  },
  citiesInDistrict: async (districtNodeId: string) => {
    const descendants = await hierarchyNodeApi.action<HierarchyNode[]>(`${districtNodeId}/descendants`);
    const cityLevels = new Set(["Corporation", "Municipality", "Town Panchayat", "Panchayat Union", "Panchayat"]);
    return (descendants ?? []).filter((node: any) => cityLevels.has(node.level_name));
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
  districts: async (signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceLocationNode[]>("/publicgrivence/districts/", { signal });
    return data;
  },
  cities: async (districtNodeId: string, signal?: AbortSignal) => {
    const { data } = await api.get<PublicGrievanceLocationNode[]>("/publicgrivence/cities/", {
      params: { district: districtNodeId },
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
