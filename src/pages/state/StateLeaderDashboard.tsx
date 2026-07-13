import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Building2, Info, LogOut, MapPin } from "lucide-react";
import ZigmaLogo from "../../images/logo.png";
import { API_ROOT } from "../../config/configApi";

const stApi = axios.create({ baseURL: API_ROOT });
stApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("st_access_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function clearStateSession() {
  ["st_access_token", "st_state_unique_id", "st_state_name", "st_leader_name", "st_role"].forEach((k) =>
    localStorage.removeItem(k)
  );
}

type DistrictRow = {
  district_id: string;
  district_name: string;
  is_active: boolean;
};

type StateDashboardResponse = {
  state_id: string;
  state_name: string;
  districts: DistrictRow[];
  kpis: { total_districts: number };
  trip_analytics: null;
  trip_analytics_note?: string;
};

export default function StateLeaderDashboard() {
  const navigate = useNavigate();
  const leaderName = localStorage.getItem("st_leader_name") ?? "Leader";
  const [stateLabel, setStateLabel] = useState(localStorage.getItem("st_state_name") ?? "");

  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [tripNote, setTripNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("st_role");
    const token = localStorage.getItem("st_access_token");
    if (role !== "state_leader" || !token) navigate("/state", { replace: true });
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await stApi.get<StateDashboardResponse>("/statebody/dashboard/");
      setDistricts(Array.isArray(data?.districts) ? data.districts : []);
      setTripNote(data?.trip_analytics_note ?? "");
      if (data?.state_name) {
        setStateLabel(data.state_name);
        localStorage.setItem("st_state_name", data.state_name);
      }
    } catch {
      setDistricts([]);
      setError("Unable to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    clearStateSession();
    navigate("/state", { replace: true });
  };

  const activeCount = districts.filter((d) => d.is_active).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="border-b border-violet-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={ZigmaLogo} className="h-9 w-9 object-contain" alt="Zigma" />
            <div>
              <p className="text-sm font-black tracking-wide text-gray-800">ZIGMA IWMS</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">
                State Body Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{leaderName}</p>
              <p className="text-xs text-gray-500">{stateLabel || "State Leader"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-slate-50 transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50">
            <Building2 className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              {stateLabel || "State"} Dashboard
            </h1>
            <p className="text-sm text-gray-500">Districts under your jurisdiction</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Total Districts
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{districts.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Active Districts
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{activeCount}</p>
          </div>
        </div>

        {tripNote && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{tripNote}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* District table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-800">Districts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-widest text-gray-400">
                  <th className="px-5 py-3 font-semibold">District</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-6 text-center text-gray-400">
                      Loading…
                    </td>
                  </tr>
                ) : districts.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-5 py-6 text-center text-gray-400">
                      No districts found for this state.
                    </td>
                  </tr>
                ) : (
                  districts.map((d) => (
                    <tr key={d.district_id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-violet-400" />
                          <span className="font-medium text-gray-800">{d.district_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            d.is_active
                              ? "bg-green-50 border border-green-200 text-green-700"
                              : "bg-slate-100 border border-slate-200 text-slate-500"
                          }`}
                        >
                          {d.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
