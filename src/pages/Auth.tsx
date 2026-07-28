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
import { toSwalMessage } from "@/lib/zodErrors";
import { loginSchema } from "@/schemas/auth.schema";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  LogIn,
  UserRound,
  Leaf,
} from "lucide-react";

import LoginBg from "../images/bg1.png";
import Logo from "../images/logo-zigma.png";

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
    const validation = loginSchema.safeParse({ username, password });
    if (!validation.success) {
      toast({
        title: t("login.title"),
        description: toSwalMessage(validation.error),
        variant: "destructive",
      });
      return;
    }
    setLoading(true);

    try {
      const res = await api.post<LoginResponse>("/login/", {
        username: validation.data.username,
        password: validation.data.password,
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
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat px-4 py-10 font-sans md:justify-end md:px-16"
      style={{ backgroundImage: `url(${LoginBg})` }}
    >
      {/* ── Logo (top-left) ─────────────────────────────────────── */}
      <img
        src={Logo}
        alt="IWMS"
        className="absolute left-6 top-6 z-10 h-12 w-auto object-contain md:left-10 md:top-8 md:h-24"
      />

      {/* ── Login card ──────────────────────────────────────────── */}
      <div className="w-full max-w-md rounded-[2rem] border border-white/60 bg-white/95 p-8 shadow-2xl shadow-slate-400/30 backdrop-blur-sm sm:p-10">

        {/* avatar ring */}
        <div className="mb-6 flex justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-green-100 bg-green-50">
            <UserRound className="h-11 w-11 text-green-600" />
            <Leaf className="absolute bottom-3 right-4 h-4 w-4 text-green-500" />
          </div>
        </div>

        {/* heading */}
        <div className="mb-7 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
            Welcome <span className="text-green-600">Back!</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
            Login to access the Integrated Waste Management System
          </p>
        </div>

        {/* form */}
        <form onSubmit={handleSignIn} className="space-y-5">

          {/* username */}
          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-sm font-semibold text-slate-700">
              Username or Email
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="username"
                type="text"
                placeholder="Enter your username or email"
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 text-slate-900 placeholder:text-slate-400 focus-visible:border-green-400 focus-visible:ring-green-300/50 transition-all"
                required
              />
            </div>
          </div>

          {/* password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-12 text-slate-900 placeholder:text-slate-400 focus-visible:border-green-400 focus-visible:ring-green-300/50 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* forgot */}
          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm font-semibold text-green-600 hover:underline"
              onClick={() => navigate("/auth/forgot-password")}
            >
              {t("login.forgot_password")}
            </button>
          </div>

          {/* submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 text-sm font-semibold text-white shadow-lg shadow-green-200 transition-all hover:bg-green-800 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                {t("login.authenticating")}
              </>
            ) : (
              <>
                <LogIn size={18} />
                Login
              </>
            )}
          </button>
        </form>

        {/* card footer */}
        <p className="mt-7 flex items-center justify-center gap-1.5 text-sm text-slate-500">
          <Leaf className="h-4 w-4 text-green-500" />
          Together for a Sustainable Future
        </p>
      </div>
    </div>
  );
}
