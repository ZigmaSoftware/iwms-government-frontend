import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, User, Building2, Leaf, AlertCircle } from "lucide-react";
import ZigmaLogo from "../images/logo.png";
import AnimatedLoginScene from "@/components/auth/AnimatedLoginScene";
import LoginFeatureChain from "@/components/auth/LoginFeatureChain";
import "@/components/auth/animated-login.css";
import {
  unwrapLoginPayload,
  type LoginEnvelope,
} from "@/utils/authStorage";
import { toSwalMessage } from "@/lib/zodErrors";
import { loginSchema } from "@/schemas/auth.schema";

const getAuthErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response?.data;
    if (response && typeof response === "object") {
      const data = response as Record<string, unknown>;
      if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
        return String(data.non_field_errors[0]);
      }
      if (typeof data.detail === "string") return data.detail;
    }
  }
  if (error instanceof Error) return error.message;
  return "Invalid credentials";
};

export default function LocalBodyAuth() {
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
  const { toast } = useToast();

  useEffect(() => {
    if (localStorage.getItem("lb_access_token")) {
      navigate("/localbody/dashboard", { replace: true });
    }
  }, [navigate]);

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
      if (!validation.success) {
        toast({
          title: "Required",
          description: toSwalMessage(validation.error),
          variant: "destructive",
        });
      }
      return;
    }
    setLoading(true);

    try {
      const res = await api.post<LoginEnvelope>("/login/login-user/", {
        username: validation.data.username,
        password: validation.data.password,
        login_type: "panchayat_leader",
      });

      const payload = unwrapLoginPayload(res.data);
      // DO NOT call persistLoginSession here — that would overwrite the
      // admin's access_token in localStorage and break the admin session.
      // Instead, store the localbody token under its own dedicated key.
      const lbToken = payload.access_token ?? payload.access ?? "";
      if (lbToken) {
        localStorage.setItem("lb_access_token", lbToken);
      }

      // Store panchayat context for the dashboard
      const profile = payload.profile ?? {};
      if (profile.panchayat_unique_id) {
        localStorage.setItem("lb_panchayat_unique_id", profile.panchayat_unique_id);
        localStorage.setItem("lb_panchayat_name", profile.panchayat_name ?? "");
      }
      localStorage.setItem("lb_leader_name", profile.leader_name ?? profile.name ?? username);
      localStorage.setItem("lb_role", "panchayat_leader");

      navigate("/localbody/dashboard", { replace: true });
    } catch (error: unknown) {
      const errorMessage = getAuthErrorMessage(error);
      setPassHint(errorMessage);
      setPassInvalid(true);
      triggerShake();

      toast({ title: "Login Failed", description: errorMessage, variant: "destructive" });
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
            <img src={ZigmaLogo} alt="Zigma IWMS" />
          </a>

          <h1 className="headline">Smart Solutions for a Cleaner, Greener Tomorrow</h1>

          <LoginFeatureChain containerRef={containerRef} />
        </section>

        <section className="right">
          <div className={`card${shake ? " shake" : ""}`} id="card">
            <div className="avatar" aria-hidden="true">
              <Building2 className="avatar-icon" />
              <Leaf className="avatar-badge" />
            </div>

            <h2 className="welcome">
              PLB Leader <em>Login</em>
            </h2>
            <p className="subtitle">Sign in to access your PLB dashboard</p>

            <form onSubmit={handleSignIn} noValidate>
              <div className={`field u${userInvalid ? " invalid" : ""}`}>
                <label htmlFor="lb-username">Username</label>
                <div className="control">
                  <span className="lead" aria-hidden="true"><User /></span>
                  <input
                    id="lb-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setUsername(e.target.value);
                      setUserInvalid(false);
                    }}
                  />
                </div>
                <p className="hint" role="alert">
                  <AlertCircle />
                  <span>Enter your username to continue.</span>
                </p>
              </div>

              <div className={`field p${passInvalid ? " invalid" : ""}`}>
                <label htmlFor="lb-password">Password</label>
                <div className="control">
                  <span className="lead" aria-hidden="true"><Lock /></span>
                  <input
                    id="lb-password"
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

              <button className={`submit${loading ? " busy" : ""}`} type="submit" disabled={loading}>
                <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
                </svg>
                <span className="label">Sign In</span>
                <svg className="spinner" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>
              </button>
            </form>

            <p className="footnote">
              <Leaf aria-hidden="true" />
              Zigma IWMS · Local Body Portal
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
