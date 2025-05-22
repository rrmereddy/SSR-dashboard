import { supabase } from "@/lib/supabaseclient";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const handleLoginGithub = (setErrorMsg: (msg: string) => void) => {
  supabase.auth.signInWithOAuth({ provider: "github" });
  setErrorMsg("");
  console.log("Initiating GitHub authentication...");
};

export const handleLoginGoogle = (setErrorMsg: (msg: string) => void) => {
  supabase.auth.signInWithOAuth({ provider: "google" });
  setErrorMsg("");
  console.log("Initiating Google authentication...");
};

export const handleLoginPassword = async (
  email: string,
  password: string,
  setErrorMsg: (msg: string) => void,
  router: AppRouterInstance
) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        setErrorMsg("Please verify your email address before logging in");
      } else if (error.message.includes("Invalid login credentials")) {
        setErrorMsg("Invalid email or password");
      } else {
        setErrorMsg(error.message);
      }
      return;
    }

    setErrorMsg("");
    console.log("Logged in successfully with password", data);
    router.push("/dashboard");
  } catch (error) {
    setErrorMsg("An unexpected error occurred");
    console.error("Error:", error);
  }
};

export const handleSignUp = async (
  email: string,
  password: string,
  setErrorMsg: (msg: string) => void
) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setErrorMsg("Please check your email for verification link");
    console.log("Signed up successfully", data);
  } catch (error) {
    setErrorMsg("An unexpected error occurred");
    console.error("Error:", error);
  }
};

export const handleLogout = async (router: AppRouterInstance) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error);
      return;
    }
    router.push("/auth");
  } catch (error) {
    console.error("Error during logout:", error);
  }
};

export const checkSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}; 