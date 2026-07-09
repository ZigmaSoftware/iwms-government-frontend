import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  BarChart3, Building2, Calendar, ClipboardList,
  Download, Landmark, LogOut, Printer, Scale,
} from "lucide-react";
import ZigmaLogo from "../../images/logo.png";

/* ─── axios instance ─────────────────────────────────────────────────── */
const IS_PROD = import.meta.env.VITE_PROD === "true";
const API_ROOT = IS_PROD ? import.meta.env.VITE_API_PROD : import.meta.env.VITE_API_LOCAL;

const dbApi = axios.create({ baseURL: API_ROOT });
dbApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("db_access_token");
  if (token) { config.headers = config.headers ?? {}; config.headers.Authorization = `Bearer ${token}`; }
  return config;
});

/* ─── types ──────────────────────────────────────────────── */
type PanchayatRow = {
  unique_id: string;
  panchayat_name: string;
  agreed_weight_kg: number;
  [key: string]: unknown;
};

type DistrictDashboardResponse = {
  district_name: string;
  district_unique_id?: string;
  panchayats: PanchayatRow[];
  trip_analytics: null | Record<string, unknown>;
};

function clearDistrictSession() {
  ["db_access_token", "db_district_unique_id", "db_district_name", "db_leader_name", "db_role"]
    .forEach((k) => localStorage.removeItem(k));
}

const fmt = (v?: number | null, dec = 3) =>
  v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: dec });

/* ════════════════════════════════════════════════════════════
    COMPONENT
════════════════════════════════════════════════════════════ */
export default function DistrictDashboard() {
  const navigate     = useNavigate();
  const leaderName   = localStorage.getItem("db_leader_name") ?? "Leader";
  const districtName = localStorage.getItem("db_district_name") ?? "";

  useEffect(() => {
    const role  = localStorage.getItem("db_role");
    const token = localStorage.getItem("db_access_token");
    if (role !== "district_leader" || !token) navigate("/district", { replace: true });
  }, [navigate]);

  /* ── data ── */
  const [panchayats, setPanchayats] = useState<PanchayatRow[]>([]);
  const [tripAnalytics, setTripAnalytics] = useState<Record<string, unknown> | null>(null);
  const [districtLabel, setDistrictLabel] = useState(districtName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await dbApi.get<DistrictDashboardResponse>("/districtbody/dashboard/");
      setPanchayats(Array.isArray(data?.panchayats) ? data.panchayats : []);
      setTripAnalytics(data?.trip_analytics ?? null);
      if (data?.district_name) {
        setDistrictLabel(data.district_name);
        localStorage.setItem("db_district_name", data.district_name);
      }
    } catch {
      setPanchayats([]);
      setTripAnalytics(null);
      setError("Unable to load data. Please try again.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchData(); }, []);

  /* ── totals ── */
  const totals = useMemo(() => ({
    panchayatCount: panchayats.length,
    agreed: panchayats.reduce((s, r) => s + Number(r.agreed_weight_kg ?? 0), 0),
  }), [panchayats]);

  /* ── actions ── */
  const handlePrint = () => window.print();

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(panchayats.map((r, i) => ({
      "S.No": i + 1, "Panchayat": r.panchayat_name, "Agreed (Kg)": r.agreed_weight_kg,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "District Report");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]),
      `district-report-${districtLabel}.xlsx`);
  };

  /* ── shared header ── */
  const Header = (
    <header className="print:hidden sticky top-0 z-20 flex items-center justify-between px-6 h-16 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
          <img src={ZigmaLogo} className="h-7 w-7 object-contain" alt="Zigma" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800 leading-tight">IWMS Portal</p>
          <p className="text-[11px] text-gray-400 leading-tight">District Leader Dashboard</p>
        </div>
      </div>

      <p className="text-sm font-medium text-gray-700 hidden md:block">
        <span className="font-semibold text-amber-600">{districtLabel}</span>
        <span className="text-gray-300 mx-2">|</span>
        Waste Collection Analytics
      </p>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
          <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
            {(leaderName[0] ?? "L").toUpperCase()}
          </span>
          <span className="text-xs font-semibold text-gray-700 hidden sm:block">{leaderName}</span>
        </div>
        <button
          onClick={() => { clearDistrictSession(); navigate("/district", { replace: true }); }}
          className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
      </div>
    </header>
  );

  /* ── print-only company header ── */
  const PrintHeader = (
    <div className="hidden print:block mb-6">
      <div className="flex items-center justify-between pb-3 border-b-2 border-amber-500">
        <div className="flex items-center gap-3">
          <img src={ZigmaLogo} className="h-12 w-12 object-contain" alt="Zigma" />
          <div>
            <p className="text-base font-bold text-gray-900">ZIGMA Global Environ Solutions Pvt. Ltd.</p>
            <p className="text-sm text-gray-500">{districtLabel} — IWMS District Leader Portal</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">Printed: {new Date().toLocaleString("en-IN")}</p>
      </div>
    </div>
  );

  /* ── stat card ── */
  const StatCard = ({
    label, value, accent, icon,
  }: { label: string; value: string; accent: string; icon: React.ReactNode }) => (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden border-t-4 ${accent} flex flex-col gap-2 p-4`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-gray-500 leading-tight">{label}</p>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800 leading-none">{loading ? "—" : value}</p>
    </div>
  );

  /* ── action button ── */
  const ActionBtn = ({
    label, icon, onClick, variant = "amber",
  }: { label: string; icon: React.ReactNode; onClick: () => void; variant?: "amber" | "gray" }) => {
    const cls = {
      amber: "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-300",
      gray:  "border-gray-200  text-gray-600  bg-gray-50  hover:bg-gray-100  hover:border-gray-300",
    }[variant];
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-all hover:shadow-sm print:hidden ${cls}`}
      >
        {icon} {label}
      </button>
    );
  };

  const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-3 text-xs font-semibold text-white bg-amber-600 border-r border-white/20 last:border-0 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );

  return (
    <div className="min-h-screen font-sans bg-gray-50">
      {Header}
      <main className="p-6 space-y-6 max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* ── Welcome strip ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Welcome, <span className="text-amber-600">{leaderName}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {districtLabel} · District Waste Collection Report Portal
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4 text-amber-500" />
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>

        {PrintHeader}

        {/* ── KPI Stats ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800">District Waste Statistics</h2>
              <p className="text-sm text-gray-400 mt-0.5">Panchayat coverage &amp; agreed collection weight</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Panchayats in District" value={fmt(totals.panchayatCount, 0)} accent="border-t-amber-500" icon={<Building2 className="h-4 w-4" />} />
              <StatCard label="Total Agreed Weight (Kg)" value={fmt(totals.agreed)} accent="border-t-orange-500" icon={<Scale className="h-4 w-4" />} />
              <StatCard label="Avg. Agreed Weight / Panchayat (Kg)" value={fmt(totals.panchayatCount ? totals.agreed / totals.panchayatCount : 0)} accent="border-t-yellow-500" icon={<BarChart3 className="h-4 w-4" />} />
            </div>
          </div>
        </div>

        {/* ── Trip analytics placeholder ── */}
        {!tripAnalytics && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-6 py-4 text-sm flex items-start gap-3 print:hidden">
            <Landmark className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Trip-level analytics for this district are not available yet. This section will populate once trip data is wired up for district-level reporting.</p>
          </div>
        )}

        {/* ── Panchayat table ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Panchayats in {districtLabel || "this District"}</h2>
              <p className="text-sm text-gray-400 mt-0.5">Agreed collection weight by panchayat</p>
            </div>
            <div className="flex items-center gap-2">
              <ActionBtn label="Download" icon={<Download className="h-3.5 w-3.5" />} onClick={downloadExcel} variant="amber" />
              <ActionBtn label="Print" icon={<Printer className="h-3.5 w-3.5" />} onClick={handlePrint} variant="gray" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm gap-2">
                <span className="animate-spin h-5 w-5 border-2 border-gray-200 rounded-full border-t-amber-500" />
                Loading data…
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <TH>S.No</TH>
                    <TH>Panchayat</TH>
                    <TH right>Agreed Weight (Kg)</TH>
                  </tr>
                </thead>
                <tbody>
                  {panchayats.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-gray-400 text-sm">
                        <ClipboardList className="h-5 w-5 mx-auto mb-2 text-gray-300" />
                        No panchayats found for this district.
                      </td>
                    </tr>
                  ) : panchayats.map((r, i) => (
                    <tr
                      key={r.unique_id}
                      className="border-t border-gray-50 hover:bg-amber-50/50 transition-colors"
                      style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                    >
                      <td className="px-3 py-2.5 text-gray-400 text-xs font-medium w-12">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-700">{r.panchayat_name}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-amber-600">{fmt(r.agreed_weight_kg)}</td>
                    </tr>
                  ))}
                </tbody>
                {panchayats.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2" style={{ borderColor: "#f59e0b60", background: "#fffbeb" }}>
                      <td colSpan={2} className="px-3 py-3 text-right text-sm font-bold text-gray-700">Total</td>
                      <td className="px-3 py-3 text-right font-bold text-amber-600">{fmt(totals.agreed)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>

        {panchayats.length > 0 && (
          <p className="text-xs text-gray-400 print:hidden">
            Showing {panchayats.length} panchayat{panchayats.length !== 1 ? "s" : ""}
          </p>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-5 border-t border-gray-100 mt-4 print:mt-8">
        Copyright © 2017–2026 ZIGMA Global Environ Solutions · All Rights Reserved.
      </footer>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          main, main * { visibility: visible; }
          main { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          table { font-size: 11px; border-collapse: collapse; }
          th, td { padding: 5px 8px !important; border: 1px solid #e5e7eb; }
          thead th { background: #d97706 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr:nth-child(even) { background: #f9fafb !important; }
          tfoot tr { background: #fffbeb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
