import { supabase } from "@/lib/supabaseclient";
import { AuthError } from '@supabase/supabase-js';

export const handleLoginGithub = () => {
  supabase.auth.signInWithOAuth({ provider: "github" });
};

export const handleLoginGoogle = () => {
  supabase.auth.signInWithOAuth({ provider: "google" })
};

export async function handleLoginPassword(
  email: string,
  password: string
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

export const handleSignUp = async (
  email: string,
  password: string,
  setErrorMsg: (msg: string) => void
) => {
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

  } catch (error) {
    setErrorMsg("An unexpected error occurred");
    console.error("Error:", error);
  }
};

export const handleLogout = async (): Promise<{ error: AuthError | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
    return { error: error as AuthError };

  } catch (error) {
    console.error("Error during logout:", error);
    return { error: error as AuthError };
  }
};

export const checkSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}; 