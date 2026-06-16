import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, User, Lock } from "lucide-react";
import ZigmaLogo from "@/images/logo.png";

export default function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !email.trim()) {
      setError("Please enter both username and email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password/", { username, email });
      const sessionToken: string | undefined = res.data?.session_token;
      if (!sessionToken) {
        // Username/email combination not found — show generic message without revealing which
        setError("No account found matching the provided username and email address.");
        return;
      }
      navigate("/auth/verify-otp", {
        state: { sessionToken, email, username },
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-slate-50 p-4">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-green-300/55 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-orange-200/55 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="border border-white/80 shadow-2xl shadow-slate-300/50 rounded-3xl overflow-hidden">
          <CardHeader className="bg-white px-8 pt-8 pb-4">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-full border-2 border-green-200 bg-green-50 p-2">
                <img src={ZigmaLogo} className="h-8 w-8 object-contain" alt="Zigma" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-800">ZIGMA IWMS</p>
              </div>
            </div>

            {/* Lock icon */}
            <div className="mb-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-green-200 bg-green-50">
                <Lock className="h-5 w-5 text-green-600" />
              </div>
            </div>

            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
              Forgot Password
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1 leading-relaxed">
              Enter your username and registered email address. We'll send you an OTP to reset your password.
            </CardDescription>
          </CardHeader>

          <CardContent className="bg-white px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Username
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-gray-900 placeholder:text-gray-400 focus-visible:border-green-400 focus-visible:ring-green-300/50"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-10 text-gray-900 placeholder:text-gray-400 focus-visible:border-green-400 focus-visible:ring-green-300/50"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-semibold shadow-lg shadow-orange-200/70 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                    Sending OTP…
                  </>
                ) : (
                  "Send OTP"
                )}
              </Button>

              <div className="flex justify-center pt-2">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:underline"
                >
                  <ArrowLeft size={14} />
                  Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
