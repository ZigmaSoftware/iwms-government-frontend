import { useEffect, useRef, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { notificationActions } from "@/features/complaintTicketing/api";
import type { ComplaintNotification } from "@/features/complaintTicketing/types";

const UNREAD_POLL_MS = 30000;

const timeAgo = (iso?: string) => {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const EVENT_DOT_COLOR: Record<string, string> = {
  ASSIGNED: "bg-success-500",
  ESCALATED_TO: "bg-orange-500",
  ESCALATED: "bg-orange-400",
  RESOLVED: "bg-success-500",
  REOPENED: "bg-error-500",
};

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ComplaintNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshUnreadCount = async () => {
    try {
      const res = await notificationActions.unreadCount();
      setUnreadCount(res.unread_count ?? 0);
    } catch {
      // Notifications are best-effort; a failed poll shouldn't disrupt the UI.
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    pollRef.current = setInterval(refreshUnreadCount, UNREAD_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const rows = await notificationActions.list();
      setNotifications(rows);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  function toggleDropdown() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) loadNotifications();
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleNotificationClick = async (notification: ComplaintNotification) => {
    if (!notification.is_read) {
      try {
        await notificationActions.markRead(notification.unique_id);
        setNotifications((prev) =>
          prev.map((item) => (item.unique_id === notification.unique_id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Ignore - the notification stays unread and can be retried later.
      }
    }
    closeDropdown();
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationActions.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignore - user can retry.
    }
  };

  return (
    <div className="relative">
      <button
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surfaceAlt)]/95 text-[var(--admin-text)] shadow-[0_12px_30px_rgba(1,62,126,0.12)] transition hover:border-[var(--admin-primarySoft)] hover:bg-[var(--admin-primarySoft)]/80 hover:text-[var(--admin-primary)]"
        onClick={toggleDropdown}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 ${
            unreadCount === 0 ? "hidden" : "flex"
          }`}
        >
          <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
        </span>
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surfaceAlt)]/98 p-4 text-[var(--admin-text)] shadow-[var(--admin-cardShadow)] sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}
          </h5>
          <button
            onClick={toggleDropdown}
            className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg
              className="fill-current"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {loading && (
            <li className="p-4 text-center text-sm text-gray-500">Loading...</li>
          )}
          {!loading && notifications.length === 0 && (
            <li className="p-4 text-center text-sm text-gray-500">No notifications yet.</li>
          )}
          {!loading && notifications.map((notification) => (
            <li key={notification.unique_id}>
              <DropdownItem
                onItemClick={() => handleNotificationClick(notification)}
                className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 text-left hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
                  notification.is_read ? "" : "bg-blue-50/60 dark:bg-white/5"
                }`}
              >
                <span className="relative mt-1 block h-2.5 w-2.5 shrink-0 rounded-full">
                  <span
                    className={`block h-2.5 w-2.5 rounded-full ${EVENT_DOT_COLOR[notification.event_type] ?? "bg-gray-400"}`}
                  ></span>
                </span>

                <span className="block">
                  <span className="mb-1 block text-theme-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {notification.title}
                    </span>
                  </span>
                  {notification.message && (
                    <span className="mb-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                      {notification.message}
                    </span>
                  )}
                  <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                    <span>{notification.ticket_no || "Grievance"}</span>
                    <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                    <span>{timeAgo(notification.created_at)}</span>
                  </span>
                </span>
              </DropdownItem>
            </li>
          ))}
        </ul>
        <button
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className="block px-4 py-2 mt-3 text-sm font-medium text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Mark all as read
        </button>
      </Dropdown>
    </div>
  );
}
