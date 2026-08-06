import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/api";
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
  UserRound,
  Leaf,
  AlertCircle,
} from "lucide-react";

import Logo from "../images/logo-zigma.png";
import AnimatedLoginScene from "@/components/auth/AnimatedLoginScene";
import LoginFeatureChain from "@/components/auth/LoginFeatureChain";
import "@/components/auth/animated-login.css";

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

  const [userInvalid, setUserInvalid] = useState(false);
  const [passInvalid, setPassInvalid] = useState(false);
  const [passHint, setPassHint] = useState("Enter your password to continue.");
  const [shake, setShake] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const triggerShake = () => {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  };

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUserInvalid(false);
    setPassInvalid(false);

    const validation = loginSchema.safeParse({ username, password });
    if (!validation.success) {
      if (!username.trim()) setUserInvalid(true);
      if (!password) {
        setPassHint("Enter your password to continue.");
        setPassInvalid(true);
      }
      triggerShake();
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

      if (hasAdminAccess) {
        setAdminViewPreference(ADMIN_VIEW_MODE_ADMIN);
        navigate("/admin", { replace: true });
      } else {
        clearAdminViewPreference();
        navigate("/", { replace: true });
      }
    } catch (error: unknown) {
      const errorMessage = getLoginErrorMessage(error);

      setPassHint(errorMessage);
      setPassInvalid(true);
      triggerShake();

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
    <div className="zigma-login" ref={containerRef}>
      <AnimatedLoginScene containerRef={containerRef} />

      <main className="page">
        <section className="left">
          <a className="brand" href="#" aria-label="Zigma home" onClick={(e) => e.preventDefault()}>
            <img src={Logo} alt="IWMS" />
          </a>

          <h1 className="headline">Smart Solutions for a Cleaner, Greener Tomorrow</h1>

          <LoginFeatureChain containerRef={containerRef} />
        </section>

        <section className="right">
          <div className={`card${shake ? " shake" : ""}`} id="card">
            <div className="avatar" aria-hidden="true">
              <UserRound className="avatar-icon" />
              <Leaf className="avatar-badge" />
            </div>

            <h2 className="welcome">
              Welcome <em>Back!</em>
            </h2>
            <p className="subtitle">Login to access the Integrated Waste Management System</p>

            <form onSubmit={handleSignIn} noValidate>
              <div className={`field u${userInvalid ? " invalid" : ""}`}>
                <label htmlFor="username">Username or Email</label>
                <div className="control">
                  <span className="lead" aria-hidden="true"><User /></span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username or email"
                    value={username}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setUsername(e.target.value);
                      setUserInvalid(false);
                    }}
                  />
                </div>
                <p className="hint" role="alert">
                  <AlertCircle />
                  <span>Enter your username or email to continue.</span>
                </p>
              </div>

              <div className={`field p${passInvalid ? " invalid" : ""}`}>
                <label htmlFor="password">Password</label>
                <div className="control">
                  <span className="lead" aria-hidden="true"><Lock /></span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setPassword(e.target.value);
                      setPassInvalid(false);
                    }}
                  />
                  <button
                    type="button"
                    className="reveal"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="hint" role="alert">
                  <AlertCircle />
                  <span>{passHint}</span>
                </p>
              </div>

              <button
                type="button"
                className="forgot"
                onClick={() => navigate("/auth/forgot-password")}
              >
                {t("login.forgot_password")}
              </button>

              <button className={`submit${loading ? " busy" : ""}`} type="submit" disabled={loading}>
                <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
                </svg>
                <span className="label">Login</span>
                <svg className="spinner" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>
              </button>
            </form>

            <p className="footnote">
              <Leaf aria-hidden="true" />
              Together for a Sustainable Future
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
