"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseclient";
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { 
  handleLoginGithub, 
  handleLoginGoogle, 
  handleLoginPassword, 
  handleSignUp,
  checkSession
} from "@/lib/auth";
import { toast } from "sonner";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    // Check current session when the component mounts
    checkSession().then((session) => {
      if (session) {
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (e.g., after OAuth redirect)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setErrorMsg("");
          router.push("/dashboard");
        } else {
          setLoading(false);
        }
      }
    );

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [router]);

  const handleSubmit = () => {
    if (email.trim() === "" || password.trim() === "") {
      setErrorMsg("Please fill in all fields");
      toast.error("Please fill in all fields");
      return;
    }
    
    if (isLogin) {
      handleLoginPassword(email, password, setErrorMsg, router);
    } else {
      handleSignUp(email, password, setErrorMsg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#e8d5b9' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#e8d5b9' }}>
      <div 
        className="p-8 rounded-3xl shadow-2xl w-full max-w-md transform hover:scale-105 transition-transform duration-300 ease-in-out"
        style={{ 
          backgroundColor: '#d9c6a8',
          border: '2px solid #b39f84'
        }}
      >
        {/* Header */}
        <div className="border-b-2 border-dashed pb-4 mb-6 text-center" style={{ borderColor: '#b39f84' }}>
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight" style={{ color: '#5c4a32' }}>
            Resume Analyzer
          </h1>
          <p className="text-lg" style={{ color: '#5c4a32', opacity: 0.8 }}>
            Craft your perfect career story with AI
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div 
            className="border px-4 py-3 rounded-lg mb-6 text-sm text-center animate-pulse"
            style={{ 
              backgroundColor: '#f4f1ed',
              borderColor: '#b39f84',
              color: '#5c4a32'
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Input fields */}
        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5c4a32', opacity: 0.6 }} size={20} />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition duration-200"
              style={{ 
                backgroundColor: '#f4f1ed',
                border: '1px solid #b39f84',
                color: '#5c4a32'
              }}
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#5c4a32', opacity: 0.6 }} size={20} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition duration-200"
              style={{ 
                backgroundColor: '#f4f1ed',
                border: '1px solid #b39f84',
                color: '#5c4a32'
              }}
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:-translate-y-0.5 hover:opacity-90"
            style={{ 
              backgroundColor: '#b39f84',
              color: '#f4f1ed'
            }}
          >
            {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
            {isLogin ? "Login" : "Sign Up"} with Email
          </button>

          {/* Toggle login/signup */}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg("");
            }}
            className="w-full text-sm hover:underline mt-2 transition duration-200"
            style={{ color: '#5c4a32' }}
          >
            {isLogin
              ? "Don't have an account? Create one!"
              : "Already have an account? Sign In!"}
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" style={{ borderColor: '#b39f84' }}></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-2" style={{ backgroundColor: '#d9c6a8', color: '#5c4a32', opacity: 0.7 }}>
              Or continue with
            </span>
          </div>
        </div>

        {/* Social Login Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => handleLoginGithub(setErrorMsg)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:-translate-y-0.5 hover:opacity-90"
            style={{ 
              backgroundColor: '#5c4a32',
              color: '#f4f1ed'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-github-icon lucide-github">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
              <path d="M9 18c-4.51 2-5-2-7-2"/>
            </svg> 
            GitHub
          </button>
          
          <button
            onClick={() => handleLoginGoogle(setErrorMsg)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:-translate-y-0.5 hover:opacity-90"
            style={{ 
              backgroundColor: '#b39f84',
              color: '#f4f1ed'
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}