import { adminApi } from "@/helpers/admin/registry";
import type {
  ComplaintCategory,
  ComplaintFeedback,
  ComplaintLanguage,
  ComplaintPriority,
  ComplaintSource,
  ComplaintStatus,
  ComplaintSubcategory,
  ComplaintTeam,
  ComplaintTicket,
  Grievance,
} from "./types";

export const complaintTicketApi = adminApi.complaintTickets as typeof adminApi.complaintTickets;
export const complaintCategoryApi = adminApi.complaintCategories as typeof adminApi.complaintCategories;
export const complaintSubcategoryApi = adminApi.complaintSubcategories as typeof adminApi.complaintSubcategories;
export const complaintPriorityApi = adminApi.complaintPriorities as typeof adminApi.complaintPriorities;
export const complaintStatusApi = adminApi.complaintStatuses as typeof adminApi.complaintStatuses;
export const complaintSourceApi = adminApi.complaintSources as typeof adminApi.complaintSources;
export const complaintLanguageApi = adminApi.complaintLanguages as typeof adminApi.complaintLanguages;
export const complaintTeamApi = adminApi.complaintTeams as typeof adminApi.complaintTeams;
export const complaintFeedbackApi = adminApi.complaintFeedback as typeof adminApi.complaintFeedback;

export const complaintTicketingApi = {
  tickets: complaintTicketApi,
  categories: complaintCategoryApi,
  subcategories: complaintSubcategoryApi,
  priorities: complaintPriorityApi,
  statuses: complaintStatusApi,
  sources: complaintSourceApi,
  languages: complaintLanguageApi,
  teams: complaintTeamApi,
  feedback: complaintFeedbackApi,
};

export type {
  ComplaintCategory,
  ComplaintFeedback,
  ComplaintLanguage,
  ComplaintPriority,
  ComplaintSource,
  ComplaintStatus,
  ComplaintSubcategory,
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
};

export async function fetchGrievances(signal?: AbortSignal) {
  const data = await complaintTicketApi.readAll({ signal });
  return data as Grievance[];
}
