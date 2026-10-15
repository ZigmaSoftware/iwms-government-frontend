import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Camera, CheckCircle2, Clock3, ChevronLeft, ChevronRight, ImageOff, Loader2, MapPin,
  ShieldCheck, ThumbsUp, X,
} from "lucide-react";

import { publicGrievanceApi } from "@/features/complaintTicketing/api";
import type { GrievanceAreaDetail, GrievancePin } from "@/features/complaintTicketing/types";

/* ─────────────────────────────────────────────────────────────────────
   One complaint, opened from the public map: photo, place, how long it has
   been open, who is accountable at each escalation level, and two anonymous
   actions — "I saw this too" and "Verify Cleanup" (a photo the officer
   handling it approves to close the complaint). Once a cleanup photo is
   waiting, or the complaint is closed, Verify Cleanup is no longer offered. Replaces the side panel on desktop and
   slides up as a bottom sheet on phones.
   ──────────────────────────────────────────────────────────────────── */

const ROYAL = "#0A5C36";

/** "govt_panchayat_union_admin" → "Panchayat Union Admin" */
const roleLabel = (code: string) =>
  code
    .replace(/^govt_/i, "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const PRIORITY_DOT: Record<string, string> = { P1: "#dc2626", P2: "#f97316", P3: "#eab308", P4: "#22c55e" };

/* Where this complaint sits on each level: handling it now (green), already
   escalated past (red — a complaint starts at the first level, so every level
   below its current one), yellow everywhere while nobody is assigned yet, or
   not reached. */
type Mark = "current" | "passed" | "unassigned" | "ahead";

const MARK: Record<Mark, { ring: string; card: string; avatar: string; badge: string; line: string }> = {
  current: {
    ring: "ring-2 ring-green-500/50",
    card: "border-green-500 bg-gradient-to-br from-green-50 to-white",
    avatar: "bg-green-600 text-white",
    badge: "bg-green-600 text-white",
    line: "bg-green-500",
  },
  passed: {
    ring: "",
    card: "border-red-300 bg-gradient-to-br from-red-50 to-white",
    avatar: "bg-red-600 text-white",
    badge: "bg-red-600 text-white",
    line: "bg-red-400",
  },
  unassigned: {
    ring: "",
    card: "border-amber-300 bg-gradient-to-br from-amber-50 to-white",
    avatar: "bg-amber-500 text-white",
    badge: "bg-amber-500 text-white",
    line: "bg-amber-300",
  },
  ahead: {
    ring: "",
    card: "border-black/10 bg-white opacity-60",
    avatar: "bg-slate-200 text-slate-500",
    badge: "bg-black/5 text-black/45",
    line: "bg-black/10",
  },
};

const markOf = (level: number, pin: GrievancePin): Mark =>
  !pin.escalation_level ? "unassigned" : level === pin.escalation_level ? "current" : level < pin.escalation_level ? "passed" : "ahead";

const markLabel = (mark: Mark, pin: GrievancePin) =>
  ({ current: pin.is_open ? "Handling now" : "Handled", passed: "Escalated", unassigned: "Not assigned", ahead: "Not reached" })[mark];

/** per-browser memory of "I saw this too" — storage can be unavailable */
const seenKey = (ticketNo: string) => `iwms-grievance-seen:${ticketNo}`;
const readSeen = (ticketNo: string) => {
  try {
    return window.localStorage.getItem(seenKey(ticketNo)) === "1";
  } catch {
    return false;
  }
};
const writeSeen = (ticketNo: string) => {
  try {
    window.localStorage.setItem(seenKey(ticketNo), "1");
  } catch {
    /* ignore */
  }
};

const ago = (days: number) => (days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days}d ago`);

export default function ComplaintDetailCard({
  pin,
  area,
  onClose,
  onPatch,
}: {
  pin: GrievancePin;
  area: GrievanceAreaDetail;
  onClose: () => void;
  /** apply a change (seen count, new cleanup photo) to this pin in the map data */
  onPatch: (patch: Partial<GrievancePin>) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [seen, setSeen] = useState(() => readSeen(pin.ticket_no));
  const [seenBusy, setSeenBusy] = useState(false);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifyDone, setVerifyDone] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const scrollTop = useRef<HTMLDivElement>(null);

  // a different complaint picked: start fresh
  useEffect(() => {
    setPhotoIndex(0);
    setSeen(readSeen(pin.ticket_no));
    setVerifyOpen(false);
    setFile(null);
    setNote("");
    setVerifyError("");
    setVerifyDone("");
    scrollTop.current?.scrollIntoView({ block: "start" });
  }, [pin.ticket_no]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const photos = pin.photos ?? [];
  const photo = photos[Math.min(photoIndex, photos.length - 1)];
  const levels = [...area.hierarchy].sort((a, b) => a.level - b.level);
  // offered only while open and no cleanup photo is already waiting
  const canVerify = pin.is_open && !pin.cleanup_pending;
  const statusLabel = !pin.is_open ? "Closed" : pin.is_escalated || pin.is_overdue ? "Escalated" : "Unresolved";
  const statusColor = !pin.is_open ? "text-green-600" : "text-red-600";
  const title = pin.subcategory || pin.category || "Complaint";
  const areaLine = [area.local_body.name, area.district_name && `${area.district_name} District`].filter(Boolean).join(", ");
  const wasteType = pin.waste_types?.length ? pin.waste_types.join(", ") : pin.category || "—";
  const reportedDays = Math.max(0, Math.floor((Date.now() - new Date(pin.created).getTime()) / 86_400_000));

  const markSeen = async () => {
    if (seen || seenBusy) return;
    setSeenBusy(true);
    try {
      const { seen_count } = await publicGrievanceApi.markSeen(pin.ticket_no);
      writeSeen(pin.ticket_no);
      setSeen(true);
      onPatch({ seen_count });
    } catch {
      /* leave the button available to try again */
    } finally {
      setSeenBusy(false);
    }
  };

  const submitCleanup = async () => {
    if (!file) {
      setVerifyError("Add a photo of the cleaned spot.");
      return;
    }
    setSending(true);
    setVerifyError("");
    try {
      const form = new FormData();
      form.append("photo", file);
      if (note.trim()) form.append("note", note.trim());
      const res = await publicGrievanceApi.verifyCleanup(pin.ticket_no, form);
      onPatch({ cleanup_pending: res.photo });
      setVerifyDone(res.message);
      setVerifyOpen(false);
      setFile(null);
      setNote("");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg = data && (data.photo || data.detail);
      setVerifyError(typeof msg === "string" ? msg : "Couldn't send the photo. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* phones: dim the map behind the sheet */}
      <button aria-label="Close complaint" onClick={onClose} className="fixed inset-0 z-[1190] bg-black/35 lg:hidden" />

      <div
        className="fixed inset-x-0 bottom-0 z-[1200] flex max-h-[90vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)] lg:static lg:z-auto lg:-m-4 lg:max-h-none lg:min-h-0 lg:flex-1 lg:rounded-2xl lg:shadow-none"
        role="dialog"
        aria-label={`Complaint ${pin.ticket_no}`}
      >
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 lg:pt-4">
          <div ref={scrollTop} />
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-black/15 lg:hidden" />

          {/* header */}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="hidden rounded-full p-1.5 text-black/50 transition hover:bg-black/5 hover:text-black lg:block" title="Back to all complaints">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRIORITY_DOT[pin.priority_code] ?? "#94a3b8" }} />
              <span className="truncate text-[#0A0A0A]">{pin.priority || "Priority"}</span>
              <span className="text-black/25">•</span>
              <span className={statusColor}>{statusLabel}</span>
            </p>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#0A5C36]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0A5C36]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0A5C36] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0A5C36]" />
              </span>
              Currently viewing
            </span>
            <button onClick={onClose} className="rounded-full p-2 text-black/55 transition hover:bg-black/5 hover:text-black lg:hidden" title="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* photo */}
          <div className="relative mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
            {photo ? (
              <img src={photo} alt={`Photo of complaint ${pin.ticket_no}`} className="h-52 w-full object-cover" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1.5 text-black/35">
                <ImageOff className="h-7 w-7" />
                <span className="text-xs font-semibold">No photo with this complaint</span>
              </div>
            )}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1.5 shadow hover:bg-white"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1.5 shadow hover:bg-white"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute left-3 top-3 flex gap-1">
                  {photos.map((_, i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all ${i === photoIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
                  ))}
                </div>
              </>
            )}
            {pin.is_open && (
              <button
                onClick={markSeen}
                disabled={seen || seenBusy}
                className={`absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg transition ${
                  seen ? "bg-green-600 text-white" : "bg-white text-red-600 hover:scale-[1.03]"
                }`}
              >
                {seenBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                {seen ? "You saw this too" : "I saw this too"}
              </button>
            )}
          </div>
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-green-700">
            <ShieldCheck className="h-3.5 w-3.5" /> All reports are anonymous
          </p>

          {/* what and where */}
          <div className="mt-3">
            <p className="text-[11px] font-bold text-black/40">{pin.ticket_no}{pin.subcategory && pin.category ? ` · ${pin.category}` : ""}</p>
            <h3 className="text-xl font-extrabold leading-tight text-[#0A0A0A]">{title}</h3>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-black/60">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-black/35" />
              <span className="line-clamp-2">{pin.location_text || areaLine}</span>
            </p>
            {pin.location_text && <p className="pl-[22px] text-xs text-black/45">{areaLine}</p>}
          </div>

          {/* stats */}
          <div className="mt-4 grid grid-cols-3 divide-x divide-black/10 border-y border-black/10 py-3">
            {[
              { value: String(pin.seen_count ?? 0), label: "People saw it", text: false },
              { value: String(pin.days_open), label: pin.is_open ? "Days open" : "Days to fix", text: false },
              { value: wasteType, label: pin.waste_types?.length ? "Waste type" : "Category", text: true },
            ].map((s) => (
              <div key={s.label} className="flex min-w-0 flex-col justify-between px-3 first:pl-0">
                <p
                  className={
                    s.text
                      ? "line-clamp-2 text-sm font-bold leading-tight text-[#0A0A0A]"
                      : "font-mono text-lg font-bold tabular-nums text-[#0A0A0A]"
                  }
                  title={s.value}
                >
                  {s.value}
                </p>
                <p className="mt-0.5 text-[11px] text-black/45">{s.label}</p>
              </div>
            ))}
          </div>

          {/* accountability */}
          <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-black/45">Accountability</p>
          <div className="mt-2 rounded-2xl border border-black/10 bg-[#FAFBFA] p-3">
            <div className="flex justify-center">
              <span className="rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-1.5 text-center shadow-sm">
                <span className="block text-[10px] font-bold text-rose-500">Your {area.local_body.category === "ulb" ? "ULB" : "RLB"}</span>
                <span className="block text-sm font-extrabold text-rose-700">{area.local_body.name}</span>
              </span>
            </div>

            {levels.length === 0 ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">
                No escalation hierarchy is configured for this area yet.
              </p>
            ) : (
              <ol className="mt-0">
                {levels.map((l, i) => {
                  const mark = markOf(l.level, pin);
                  const m = MARK[mark];
                  return (
                    <li key={l.level} className="flex flex-col items-center">
                      <span className={`h-4 w-0.5 ${i === 0 ? "bg-rose-200" : MARK[markOf(levels[i - 1].level, pin)].line}`} />
                      <div className={`w-full rounded-xl border px-3 py-2.5 transition ${m.card} ${m.ring}`}>
                        <div className="flex items-center gap-3">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${m.avatar}`}>
                            {l.officer ? initials(l.officer.name) : "—"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-black/40">Level {i + 1}</p>
                            <p className="truncate text-sm font-bold text-[#0A0A0A]">
                              {l.officer ? l.officer.name : <span className="italic text-black/40">No officer mapped</span>}
                            </p>
                            <p className="truncate text-[11px] font-semibold" style={{ color: ROYAL }}>
                              {l.roles.map(roleLabel).join(" / ")}
                              {l.officer?.designation && <span className="font-normal text-black/45"> · {l.officer.designation}</span>}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${m.badge}`}>{markLabel(mark, pin)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-semibold text-black/50">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600" /> Handling now</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-600" /> Escalated</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Not assigned</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300" /> Not reached</span>
            </div>
          </div>

          {/* a cleanup photo waiting for the officer handling it */}
          {pin.is_open && pin.cleanup_pending && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
              <img src={pin.cleanup_pending} alt="Cleanup photo" className="h-16 w-20 shrink-0 rounded-lg object-cover ring-1 ring-amber-200" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                  <Clock3 className="h-4 w-4 shrink-0" /> Cleanup reported
                </p>
                <p className="text-[11px] text-amber-900/70">Waiting for the officer handling this complaint to verify it.</p>
              </div>
            </div>
          )}

          {!pin.is_open && (
            <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> This complaint has been verified and closed.
            </p>
          )}

          {verifyDone && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {verifyDone}
            </p>
          )}

          {/* verify cleanup form */}
          {canVerify && verifyOpen && (
            <div className="mt-4 rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
              <p className="text-sm font-extrabold">Is this spot clean now?</p>
              <p className="text-xs text-black/50">Send a photo of the spot. The officer handling this complaint will check it and close the complaint.</p>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileInput.current?.click()}
                className="mt-2 flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-black/15 bg-[#F5F7F5] text-black/45 transition hover:border-[#0A5C36]/50"
              >
                {preview ? (
                  <img src={preview} alt="Selected cleanup photo" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                    <Camera className="h-6 w-6" /> Take or choose a photo
                  </span>
                )}
              </button>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Anything to add? (optional)"
                className="mt-2 w-full rounded-xl border-[1.5px] border-black/15 px-3 py-2 text-sm outline-none focus:border-[#0A5C36] focus:ring-4 focus:ring-[#0A5C36]/15"
              />
              {verifyError && <p className="mt-1 text-xs font-semibold text-red-600">{verifyError}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => { setVerifyOpen(false); setVerifyError(""); }}
                  className="flex-1 rounded-xl bg-black/5 py-2.5 text-sm font-bold text-black/70 transition hover:bg-black/10"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCleanup}
                  disabled={sending}
                  className="flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Send for check
                </button>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="border-t border-black/5 bg-white px-4 pb-4 pt-2.5">
          <p className="text-center text-[11px] text-black/45">
            Reported {ago(reportedDays)} · Seen by {pin.seen_count ?? 0} {pin.seen_count === 1 ? "person" : "people"}
            {pin.is_open ? ` · ${pin.days_open}d unresolved` : " · resolved"}
          </p>
          {canVerify && !verifyOpen && (
            <button
              onClick={() => { setVerifyOpen(true); setVerifyDone(""); }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-green-500 to-green-700 py-3.5 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(22,163,74,0.8)] transition hover:brightness-105"
            >
              <CheckCircle2 className="h-5 w-5" /> Verify Cleanup
            </button>
          )}
        </div>
      </div>
    </>
  );
}
