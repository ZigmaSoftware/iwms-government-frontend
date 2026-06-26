import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, LogOut, LayoutDashboard, MapPin, User } from "lucide-react";
import ZigmaLogo from "../../images/logo.png";

export default function LocalBodyWelcome() {
  const navigate = useNavigate();

  const token = localStorage.getItem("lb_access_token");
  const leaderName = localStorage.getItem("lb_leader_name") ?? "Leader";
  const panchayatName = localStorage.getItem("lb_panchayat_name") ?? "";

  useEffect(() => {
    if (!token) {
      navigate("/localbody", { replace: true });
    }
  }, [token, navigate]);

  if (!token) return null;

  const handleLogout = () => {
    ["lb_access_token", "lb_panchayat_unique_id", "lb_panchayat_name", "lb_leader_name", "lb_role"].forEach(
      (key) => localStorage.removeItem(key)
    );
    navigate("/localbody", { replace: true });
  };

  return (
    <>
      <style>{`
        @keyframes lb-blob {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(20px,-18px) scale(1.05); }
          66%      { transform: translate(-15px,15px) scale(0.97); }
        }
        .lb-blob-a { animation: lb-blob 9s ease-in-out infinite; }
        .lb-blob-b { animation: lb-blob 11s ease-in-out infinite reverse; animation-delay:-3s; }
        .lb-blob-c { animation: lb-blob 13s ease-in-out infinite; animation-delay:-6s; }
        @keyframes lb-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lb-fade-up { animation: lb-fade-up 0.5s ease both; }
        .lb-fade-up-1 { animation-delay: 0.1s; }
        .lb-fade-up-2 { animation-delay: 0.2s; }
        .lb-fade-up-3 { animation-delay: 0.3s; }
        .lb-fade-up-4 { animation-delay: 0.4s; }
      `}</style>

      <div className="relative min-h-screen overflow-hidden bg-slate-50 font-sans">

        {/* Background blobs */}
        <div className="lb-blob-a pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-blue-300/40 blur-3xl" />
        <div className="lb-blob-b pointer-events-none fixed -bottom-40 -right-40 h-112 w-112 rounded-full bg-teal-200/40 blur-3xl" />
        <div className="lb-blob-c pointer-events-none fixed top-1/2 left-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-200/35 blur-3xl" />

        {/* Top navbar */}
        <header className="relative z-20 flex items-center justify-between border-b border-blue-100 bg-white/80 px-6 py-3 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-1.5">
              <img src={ZigmaLogo} className="h-7 w-7 object-contain" alt="Zigma" />
            </div>
            <div>
              <p className="text-sm font-black tracking-wide text-gray-800">ZIGMA IWMS</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">PLB Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">{leaderName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="relative z-10 mx-auto max-w-4xl px-6 py-12">

          {/* Welcome banner */}
          <div className="lb-fade-up lb-fade-up-1 mb-8 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-500 to-blue-700 p-8 shadow-xl shadow-blue-200/60 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-200 mb-2">
                  PLB (Participating Local Bodies) Portal
                </p>
                <h1 className="text-3xl font-black tracking-tight">
                  Welcome, {leaderName}!
                </h1>
                {panchayatName && (
                  <div className="mt-2 flex items-center gap-1.5 text-blue-200">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{panchayatName}</span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur-sm">
                <Building2 className="h-12 w-12 text-white/90" />
              </div>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {[
              { icon: <LayoutDashboard className="h-5 w-5" />, title: "Waste Tracking", desc: "Monitor daily waste collection data for your panchayat", color: "blue" },
              { icon: <MapPin className="h-5 w-5" />, title: "Collection Reports", desc: "View collection point coverage and trip reports", color: "teal" },
              { icon: <Building2 className="h-5 w-5" />, title: "Civic Data", desc: "Access civic infrastructure and household records", color: "cyan" },
            ].map(({ icon, title, desc, color }) => (
              <div
                key={title}
                className={`lb-fade-up lb-fade-up-2 rounded-2xl border bg-white p-5 shadow-sm border-${color}-100`}
              >
                <div className={`mb-3 inline-flex rounded-xl bg-${color}-50 p-2.5 text-${color}-600 border border-${color}-100`}>
                  {icon}
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Status notice */}
          <div className="lb-fade-up lb-fade-up-3 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-xl bg-blue-50 p-3 border border-blue-100">
                <LayoutDashboard className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800 mb-1">Your dashboard is being set up</h2>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Your panchayat data and reports will be mapped here shortly by your administrator.
                  You are successfully logged in as <span className="font-semibold text-blue-600">{leaderName}</span>
                  {panchayatName && <> of <span className="font-semibold text-blue-600">{panchayatName}</span></>}.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="lb-fade-up lb-fade-up-4 mt-8 text-center text-[11px] text-gray-400">
            Secure session · <span className="font-semibold text-gray-500">Zigma IWMS · Local Body Portal</span>
          </p>
        </main>
      </div>
    </>
  );
}
