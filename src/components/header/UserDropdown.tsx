import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { ACCESS_TOKEN_STORAGE_KEY, clearAuthSession } from "@/utils/authStorage";
import { endLoginSession } from "@/utils/loginSession";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function UserDropdown() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const displayName = user?.name || "User";

  async function handleSignOut() {
    await endLoginSession(ACCESS_TOKEN_STORAGE_KEY, "manual");
    clearAuthSession();
    setUser(null);
    navigate("/auth", { replace: true });
  }

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "truncate max-w-[120px] text-sm font-semibold",
          isDark ? "text-slate-200" : "text-gray-800"
        )}
      >
        {displayName}
      </span>

      <button
        onClick={handleSignOut}
        title="Sign out"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
          isDark
            ? "text-slate-400 hover:bg-red-900/40 hover:text-red-400"
            : "text-gray-500 hover:bg-red-50 hover:text-red-500"
        )}
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
