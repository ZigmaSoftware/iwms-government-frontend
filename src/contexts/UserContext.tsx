import { createContext, useContext, useState, type ReactNode } from "react";
import { getStoredAuthUser } from "@/utils/authStorage";

type UserProfile = {
  name: string;
  email: string;
};

type UserContextValue = {
  user: UserProfile | null;
  setUser: (profile: UserProfile | null) => void;
};

const USER_NAME_KEY = "user_name";
const USER_EMAIL_KEY = "user_email";

const UserContext = createContext<UserContextValue | undefined>(undefined);

const getStoredUser = (): UserProfile | null => {
  const authUser = getStoredAuthUser();
  if (authUser) {
    return {
      name: String(authUser.name ?? authUser.username ?? ""),
      email: String(authUser.email ?? ""),
    };
  }

  const name = localStorage.getItem(USER_NAME_KEY);
  const email = localStorage.getItem(USER_EMAIL_KEY);

  if (name || email) {
    return { name: name ?? "", email: email ?? "" };
  }

  return null;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<UserProfile | null>(getStoredUser);

  const setUser = (profile: UserProfile | null) => {
    if (profile) {
      setUserState(profile);
      localStorage.setItem(USER_NAME_KEY, profile.name ?? "");
      localStorage.setItem(USER_EMAIL_KEY, profile.email ?? "");
    } else {
      setUserState(null);
      localStorage.removeItem(USER_NAME_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
};
