import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Building2, Eye, EyeOff, Lock, User } from "lucide-react";
import ZigmaLogo from "../images/logo.png";
import {
  unwrapLoginPayload,
  type LoginEnvelope,
} from "@/utils/authStorage";

export default function StateAuth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (localStorage.getItem("st_access_token")) {
      navigate("/state/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({ title: "Required", description: "Enter username and password.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      const res = await api.post<LoginEnvelope>("/login/login-user/", {
        username,
        password,
        login_type: "state_leader",
      });

      const payload = unwrapLoginPayload(res.data);
      // DO NOT call persistLoginSession here — that would overwrite the
      // admin's access_token in localStorage and break the admin session.
      // Instead, store the state token under its own dedicated key.
      const stToken = (payload as any).access_token ?? (payload as any).access ?? "";
      if (stToken) {
        localStorage.setItem("st_access_token", stToken);
      }

      // Store state context for the dashboard
      const profile = (payload as any).profile ?? {};
      if (profile.state_unique_id) {
        localStorage.setItem("st_state_unique_id", profile.state_unique_id);
        localStorage.setItem("st_state_name", profile.state_name ?? "");
      }
      localStorage.setItem("st_leader_name", profile.leader_name ?? profile.name ?? username);
      localStorage.setItem("st_role", "state_leader");

      navigate("/state/dashboard", { replace: true });
    } catch (error: any) {
      const message =
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.detail ||
        error?.message ||
        "Invalid credentials";
      toast({ title: "Login Failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes sb-blob {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(20px,-18px) scale(1.05); }
          66%      { transform: translate(-15px,15px) scale(0.97); }
        }
        .sb-blob-a { animation: sb-blob 9s ease-in-out infinite; }
        .sb-blob-b { animation: sb-blob 11s ease-in-out infinite reverse; animation-delay:-3s; }
        .sb-blob-c { animation: sb-blob 13s ease-in-out infinite; animation-delay:-6s; }
      `}</style>

      <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-50 p-4 font-sans">

        {/* Background blobs — violet/indigo palette for state portal */}
        <div className="sb-blob-a pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-300/45 blur-3xl" />
        <div className="sb-blob-b pointer-events-none absolute -bottom-40 -right-40 h-112 w-112 rounded-full bg-indigo-200/45 blur-3xl" />
        <div className="sb-blob-c pointer-events-none absolute top-1/2 left-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-purple-200/40 blur-3xl" />

        <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/80 shadow-2xl shadow-slate-300/50 grid md:grid-cols-2">

          {/* LEFT panel */}
          <div className="relative hidden md:flex flex-col items-center justify-between overflow-hidden bg-violet-50 p-8 border-r border-violet-100">
            <div className="sb-blob-a pointer-events-none absolute -top-10 -right-10 h-56 w-56 rounded-full bg-violet-200/50 blur-2xl" />
            <div className="sb-blob-b pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-indigo-200/50 blur-2xl" />

            <p className="relative z-10 w-full text-center text-[10px] font-bold uppercase tracking-[0.25em] text-violet-700/60">
              State Body Portal
            </p>

            <div className="relative z-10 flex flex-1 items-center justify-center w-full py-4">
              <div className="relative flex flex-col items-center justify-center gap-4">
                <div className="sb-blob-a absolute h-60 w-60 rounded-full bg-violet-200/45 blur-3xl" />
                <div className="relative z-10 rounded-full border-2 border-violet-200 bg-white p-3 shadow-xl shadow-violet-100/60">
                  <div className="rounded-full bg-violet-50 p-4">
                    <img src={ZigmaLogo} className="h-28 w-28 object-contain" alt="Zigma IWMS" />
                  </div>
                </div>
                <div className="relative z-10 flex items-center justify-center gap-2 rounded-full bg-violet-100 px-4 py-2">
                  <Building2 className="h-4 w-4 text-violet-600" />
                  <span className="text-xs font-semibold text-violet-700">State Management</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap justify-center gap-1.5 mb-4">
              {["Waste Tracking", "Collection Reports", "Civic Data"].map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                  <span className="h-1 w-1 rounded-full bg-violet-500" />
                  {f}
                </span>
              ))}
            </div>

            <div className="relative z-10 text-center mb-3">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-violet-600">ZIGMA</p>
              <p className="text-[10px] text-violet-500/70 italic mt-0.5">Alchemists of the MSW</p>
            </div>

            <div className="relative z-10 flex items-center gap-2">
              <div className="h-2 w-6 rounded-full bg-violet-500" />
              <div className="h-2 w-2 rounded-full bg-violet-200" />
              <div className="h-2 w-2 rounded-full bg-violet-200" />
            </div>
          </div>

          {/* RIGHT: form panel */}
          <div className="flex flex-col justify-center bg-white p-10">

            {/* mobile logo */}
            <div className="flex md:hidden items-center gap-3 mb-6">
              <img src={ZigmaLogo} className="h-9 w-9 object-contain" alt="Zigma" />
              <div>
                <p className="text-sm font-black tracking-wide text-gray-800">ZIGMA IWMS</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">State Portal</p>
              </div>
            </div>

            <div className="mb-5">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50">
                <Building2 className="h-5 w-5 text-violet-600" />
              </div>
            </div>

            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                State Leader Login
              </h1>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                Sign in to access your State dashboard
              </p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">

              <div className="space-y-1.5">
                <label htmlFor="sb-username" className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Username
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="sb-username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-gray-900 placeholder:text-gray-400 focus-visible:border-violet-400 focus-visible:ring-violet-300/50 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sb-password" className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="sb-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-12 text-gray-900 placeholder:text-gray-400 focus-visible:border-violet-400 focus-visible:ring-violet-300/50 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-60 text-white text-sm font-semibold shadow-lg shadow-violet-200/70 transition-all mt-1"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    Authenticating…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-[11px] text-gray-400">
              Secure login ·{" "}
              <span className="font-semibold text-gray-500">Zigma IWMS · State Portal</span>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
