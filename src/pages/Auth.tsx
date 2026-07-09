import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/api";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { usePermission } from "@/contexts/PermissionContext";
import {
  DEFAULT_ROLE,
  normalizeRole,
  setAdminViewPreference,
  clearAdminViewPreference,
  ADMIN_VIEW_MODE_ADMIN,
  isAdmin,
} from "@/types/roles";
import {
  getStoredColumnPermissions,
  getStoredPermissions,
} from "@/utils/permissions";
import {
  persistLoginSession,
  unwrapLoginPayload,
  type LoginEnvelope,
} from "@/utils/authStorage";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import ZigmaLogo from "../images/logo.png";

type LoginResponse = LoginEnvelope;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const getLoginErrorMessage = (error: unknown) => {
  const data = isRecord(error) && isRecord(error.response)
    ? error.response.data
    : undefined;
  if (data && typeof data === "object") {
    const errorData = data as Record<string, unknown>;
    if (Array.isArray(errorData.non_field_errors) && errorData.non_field_errors[0]) {
      return String(errorData.non_field_errors[0]);
    }
    if (typeof errorData.detail === "string") return errorData.detail;
    if (typeof errorData.message === "string") return errorData.message;
    const firstValue = Object.values(errorData).find((value) => {
      if (Array.isArray(value)) return Boolean(value[0]);
      return typeof value === "string" && value.trim();
    });
    if (Array.isArray(firstValue)) return String(firstValue[0]);
    if (typeof firstValue === "string") return firstValue;
  }
  return isRecord(error) && typeof error.message === "string"
    ? error.message
    : "Invalid credentials";
};

/**
 * Check if the permissions object has at least one module
 * with at least one screen that has any action allowed.
 * Handles both formats:
 *   - Array format:  { "common-masters": { "continents": ["view"] } }
 *   - Object format: { "common-masters": { "continents": { "view": true } } }
 */
function hasAnyPermission(permissions: Record<string, unknown>): boolean {
  if (!permissions || typeof permissions !== "object") return false;

  return Object.values(permissions).some((module) => {
    if (typeof module === "boolean") return module;
    if (!module || typeof module !== "object") return false;

    return Object.values(module).some((screenValue) => {
      if (typeof screenValue === "boolean") return screenValue;
      if (Array.isArray(screenValue)) return screenValue.length > 0;
      if (typeof screenValue === "object" && screenValue !== null) {
        return Object.values(screenValue).some((v) => v === true);
      }
      return false;
    });
  });
}

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { setUser } = useUser();

  // Show success toast once when redirected from reset-password
  useEffect(() => {
    const successMessage = (location.state as { successMessage?: string } | null)?.successMessage;
    if (successMessage) {
      toast({ title: "Password Reset", description: successMessage });
      window.history.replaceState({}, "");
    }
  }, [location.state, toast]);

  // Get updatePermissions so we can force React state sync after login
  const { updatePermissions } = usePermission();

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post<LoginResponse>("/login/", {
        username,
        password,
      });

      console.log("[Auth] Login response received:", res.data);

      const payload = unwrapLoginPayload(res.data);
      persistLoginSession(payload);

      const normalizedRole =
        normalizeRole(payload.user?.role ?? payload.role ?? null) ?? DEFAULT_ROLE;
      const freshPermissions = getStoredPermissions();
      updatePermissions(freshPermissions, getStoredColumnPermissions());

      //  Set user context
      setUser({
        name:
          payload.user?.name ??
          payload.user?.username ??
          payload.name ??
          payload.username ??
          username,
        email: payload.user?.email ?? payload.email ?? "",
      });

      // Check admin access by role name OR by any permission granted by superadmin
      const hasAdminAccess =
        isAdmin(normalizedRole) ||
        hasAnyPermission(freshPermissions) ||
        hasAnyPermission((payload.permissions ?? {}) as Record<string, unknown>);

      console.log(
        "[Auth] Role:", normalizedRole,
        "| permissions:", freshPermissions,
        "| hasAdminAccess:", hasAdminAccess
      );

      if (hasAdminAccess) {
        setAdminViewPreference(ADMIN_VIEW_MODE_ADMIN);
        navigate("/admin", { replace: true });
      } else {
        clearAdminViewPreference();
        navigate("/", { replace: true });
      }
    } catch (error: unknown) {
      console.error("[Auth] ❌ Login failed:", error);

      const errorMessage = getLoginErrorMessage(error);

      toast({
        title: t("login.title"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes iwms-blob {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(28px,-24px) scale(1.06); }
          66%      { transform: translate(-18px,18px) scale(0.96); }
        }
        .blob-a { animation: iwms-blob 8s ease-in-out infinite; }
        .blob-b { animation: iwms-blob 10s ease-in-out infinite reverse; animation-delay:-3s; }
        .blob-c { animation: iwms-blob 12s ease-in-out infinite; animation-delay:-6s; }
        .blob-d { animation: iwms-blob 9s ease-in-out infinite; animation-delay:-2s; }
      `}</style>

      {/* ── Page wrapper with animated blobs ────────────────────────── */}
      <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-50 p-4 font-sans">

        {/* Background blobs */}
        <div className="blob-a pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-green-300/55 blur-3xl" />
        <div className="blob-b pointer-events-none absolute -bottom-40 -right-40 h-112 w-md rounded-full bg-orange-200/55 blur-3xl" />
        <div className="blob-c pointer-events-none absolute top-1/3 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-green-200/45 blur-3xl" />
        <div className="blob-d pointer-events-none absolute top-3/4 left-1/4 h-40 w-40 rounded-full bg-emerald-200/40 blur-2xl" />

        {/* ── Card ──────────────────────────────────────────────────── */}
        <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/80 shadow-2xl shadow-slate-300/50 grid md:grid-cols-2">

          {/* ── LEFT: Illustration panel ──────────────────────────── */}
          <div className="relative hidden md:flex flex-col items-center justify-between overflow-hidden bg-green-50 p-8 border-r border-green-100">
            {/* animated green blobs */}
            <div className="blob-a pointer-events-none absolute -top-10 -right-10 h-56 w-56 rounded-full bg-green-300/45 blur-2xl" />
            <div className="blob-b pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-emerald-200/50 blur-2xl" />
            <div className="blob-c pointer-events-none absolute top-1/2 left-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-200/60 blur-xl" />
            <div className="blob-d pointer-events-none absolute bottom-1/4 right-0 h-28 w-28 rounded-full bg-orange-200/40 blur-xl" />

            {/* company label */}
            <p className="relative z-10 w-full text-center text-[10px] font-bold uppercase tracking-[0.25em] text-green-700/60">
              Integrated Waste Management System
            </p>

            {/* logo — centered with green ring */}
            <div className="relative z-10 flex flex-1 items-center justify-center w-full py-4">
              <div className="relative flex items-center justify-center">
                {/* pulsing outer glow */}
                <div className="blob-a absolute h-60 w-60 rounded-full bg-green-200/55 blur-3xl" />
                <div className="blob-c absolute h-40 w-40 rounded-full bg-emerald-300/30 blur-2xl" />
                {/* ring border */}
                <div className="relative z-10 rounded-full border-2 border-green-200 bg-white p-3 shadow-xl shadow-green-100/60">
                  <div className="rounded-full bg-green-50 p-4">
                    <img
                      src={ZigmaLogo}
                      className="h-28 w-28 object-contain"
                      alt="Zigma IWMS"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* feature pills */}
            <div className="relative z-10 flex flex-wrap justify-center gap-1.5 mb-4">
              {["Route Optimization", "Fleet Tracking", "Real-time Data"].map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-semibold text-green-700">
                  <span className="h-1 w-1 rounded-full bg-green-500" />
                  {f}
                </span>
              ))}
            </div>

            {/* brand text */}
            <div className="relative z-10 text-center mb-3">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-green-600">ZIGMA</p>
              <p className="text-[10px] text-green-500/70 italic mt-0.5">Alchemists of the MSW</p>
            </div>

            {/* carousel dots */}
            <div className="relative z-10 flex items-center gap-2">
              <div className="h-2 w-6 rounded-full bg-orange-400" />
              <div className="h-2 w-2 rounded-full bg-green-200" />
              <div className="h-2 w-2 rounded-full bg-green-200" />
            </div>
          </div>

          {/* ── RIGHT: Form panel ─────────────────────────────────── */}
          <div className="flex flex-col justify-center bg-white p-10">

            {/* mobile logo */}
            <div className="flex md:hidden items-center gap-3 mb-6">
              <img src={ZigmaLogo} className="h-9 w-9 object-contain" alt="Zigma" />
              <div>
                <p className="text-sm font-black tracking-wide text-gray-800">ZIGMA IWMS</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">Field Operations</p>
              </div>
            </div>

            {/* lock icon */}
            <div className="mb-5">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-green-200 bg-green-50">
                <Lock className="h-5 w-5 text-green-600" />
              </div>
            </div>

            {/* heading */}
            <div className="mb-7">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {t("login.title")}
              </h1>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                {t("login.subtitle")}
              </p>
            </div>

            {/* form */}
            <form onSubmit={handleSignIn} className="space-y-4">

              {/* username */}
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  {t("login.username")}
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder={t("login.username_placeholder")}
                    value={username}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-gray-900 placeholder:text-gray-400 focus-visible:border-green-400 focus-visible:ring-green-300/50 transition-all"
                    required
                  />
                </div>
              </div>

              {/* password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  {t("login.password")}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("login.password_placeholder")}
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-12 text-gray-900 placeholder:text-gray-400 focus-visible:border-green-400 focus-visible:ring-green-300/50 transition-all"
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

              {/* forgot */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-[11px] font-semibold text-green-600 hover:underline"
                  onClick={() => navigate("/auth/forgot-password")}
                >
                  {t("login.forgot_password")}
                </button>
              </div>

              {/* submit — orange gradient matching reference */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 active:scale-[0.98] disabled:opacity-60 text-white text-sm font-semibold shadow-lg shadow-orange-200/70 transition-all mt-1"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    {t("login.authenticating")}
                  </>
                ) : (
                  <>
                    {t("login.sign_in")}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* footer */}
            <p className="mt-8 text-center text-[11px] text-gray-400">
              Secure login ·{" "}
              <span className="font-semibold text-gray-500">Zigma IWMS</span>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
