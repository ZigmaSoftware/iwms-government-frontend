import { useState, useRef, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import ZigmaLogo from "@/images/logo.png";

const OTP_LENGTH = 4;

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { sessionToken?: string; email?: string; username?: string } | null;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sessionToken = state?.sessionToken ?? "";
  const maskedEmail = state?.email
    ? state.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(b.length) + c)
    : "";

  const otp = digits.join("");

  const focusNext = (index: number) => {
    if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };
  const focusPrev = (index: number) => {
    if (index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char) focusNext(index);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index]) focusPrev(index);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (otp.length < OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }
    if (!sessionToken) {
      setError("Invalid session. Please go back and request a new OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp/", {
        session_token: sessionToken,
        otp_code: otp,
      });
      const resetToken: string = res.data?.reset_token;
      navigate("/auth/reset-password", { state: { resetToken } });
    } catch (err: any) {
      setError(err?.response?.data?.message || "OTP verification failed.");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!state?.username || !state?.email) {
      setError("Session expired. Please go back and try again.");
      return;
    }
    setResending(true);
    setError("");
    setInfo("");
    try {
      const res = await api.post("/auth/forgot-password/", {
        username: state.username,
        email: state.email,
      });
      const newSessionToken: string = res.data?.session_token;
      navigate("/auth/verify-otp", {
        replace: true,
        state: { sessionToken: newSessionToken, email: state.email, username: state.username },
      });
      setInfo("A new OTP has been sent to your email.");
      setDigits(Array(OTP_LENGTH).fill(""));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not resend OTP. Please wait before trying again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-50 p-4">
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-green-300/55 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-orange-200/55 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="border border-white/80 shadow-2xl shadow-slate-300/50 rounded-3xl overflow-hidden">
          <CardHeader className="bg-white px-8 pt-8 pb-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-full border-2 border-green-200 bg-green-50 p-2">
                <img src={ZigmaLogo} className="h-8 w-8 object-contain" alt="Zigma" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-800">ZIGMA IWMS</p>
            </div>

            <div className="mb-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-green-200 bg-green-50">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>

            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
              Verify OTP
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1 leading-relaxed">
              Enter the {OTP_LENGTH}-digit OTP sent to{" "}
              {maskedEmail ? <strong>{maskedEmail}</strong> : "your registered email"}.
            </CardDescription>
          </CardHeader>

          <CardContent className="bg-white px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {info && (
                <Alert className="rounded-xl border-green-200 bg-green-50 text-green-800">
                  <AlertDescription>{info}</AlertDescription>
                </Alert>
              )}

              {/* OTP digit boxes */}
              <div className="flex justify-center gap-3">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e as KeyboardEvent<HTMLInputElement>)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    className="h-14 w-14 rounded-xl border-2 border-slate-200 bg-slate-50 text-center text-xl font-bold text-gray-900 shadow-sm transition-all focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-300/50"
                  />
                ))}
              </div>

              <Button
                type="submit"
                disabled={loading || otp.length < OTP_LENGTH}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-semibold shadow-lg shadow-orange-200/70"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    Verifying…
                  </>
                ) : (
                  "Verify OTP"
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Link
                  to="/auth/forgot-password"
                  className="inline-flex items-center gap-1.5 font-semibold text-green-600 hover:underline"
                >
                  <ArrowLeft size={14} />
                  Back
                </Link>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="font-semibold text-orange-500 hover:underline disabled:opacity-50"
                >
                  {resending ? "Resending…" : "Resend OTP"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
