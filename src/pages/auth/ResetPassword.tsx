import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/form/FieldError";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import ZigmaLogo from "@/images/logo.png";
import { newPasswordSchema, type NewPasswordFormValues } from "@/schemas/newPassword.schema";

type StrengthLevel = "weak" | "fair" | "good" | "strong";

function getPasswordStrength(pwd: string): { level: StrengthLevel; label: string; color: string; width: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { level: "weak", label: "Weak", color: "bg-red-500", width: "w-1/4" };
  if (score === 2) return { level: "fair", label: "Fair", color: "bg-orange-400", width: "w-2/4" };
  if (score === 3) return { level: "good", label: "Good", color: "bg-yellow-400", width: "w-3/4" };
  return { level: "strong", label: "Strong", color: "bg-green-500", width: "w-full" };
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { resetToken?: string } | null;

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetToken = state?.resetToken ?? "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    mode: "onChange",
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const newPassword = watch("newPassword");
  const confirmPassword = watch("confirmPassword");
  const strength = newPassword ? getPasswordStrength(newPassword) : null;
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword;

  const onValid = async (values: NewPasswordFormValues) => {
    setError("");

    if (!resetToken) {
      setError("Invalid session. Please start the password reset process again.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password/", {
        reset_token: resetToken,
        new_password: values.newPassword,
        confirm_password: values.confirmPassword,
      });
      navigate("/auth", {
        state: { successMessage: "Password reset successfully. Please log in with your new password." },
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
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
                <KeyRound className="h-5 w-5 text-green-600" />
              </div>
            </div>

            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
              Reset Password
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1 leading-relaxed">
              Choose a strong new password for your account.
            </CardDescription>
          </CardHeader>

          <CardContent className="bg-white px-8 pb-8">
            <form onSubmit={handleSubmit(onValid)} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="new_password" className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNew ? "text" : "password"}
                    placeholder="Enter new password"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 pr-12 text-gray-900 placeholder:text-gray-400 focus-visible:border-green-400 focus-visible:ring-green-300/50"
                    {...register("newPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Strength bar */}
                {strength && (
                  <div className="space-y-1 mt-1">
                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                    </div>
                    <p className={`text-xs font-semibold ${
                      strength.level === "weak" ? "text-red-500" :
                      strength.level === "fair" ? "text-orange-400" :
                      strength.level === "good" ? "text-yellow-500" :
                      "text-green-600"
                    }`}>
                      {strength.label}
                    </p>
                  </div>
                )}
                <FieldError message={errors.newPassword?.message} />
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password" className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter new password"
                    className={`h-12 rounded-xl border-slate-200 bg-slate-50 pr-12 text-gray-900 placeholder:text-gray-400 focus-visible:ring-green-300/50 transition-all ${
                      confirmPassword
                        ? passwordsMatch
                          ? "border-green-400 focus-visible:border-green-400"
                          : "border-red-400 focus-visible:border-red-400"
                        : "focus-visible:border-green-400"
                    }`}
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-500 font-medium">Passwords do not match.</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-green-600 font-medium">Passwords match.</p>
                )}
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
                    Resetting…
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
