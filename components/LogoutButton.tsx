"use client";

import { useRouter } from "next/navigation";
import { handleLogout } from "@/lib/auth";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
  className?: string;
  variant?: "default" | "ghost";
}

export default function LogoutButton({ className = "", variant = "default" }: LogoutButtonProps) {
    const router = useRouter();

  const handleClick = async () => {
    const { error } = await handleLogout();
    if (error) {
      console.error("Error logging out:", error);
    }
    router.push("/auth");
  };

  const baseStyles = "flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-lg transition duration-300 ease-in-out";
  const variantStyles = {
    default: "bg-[#b39f84] text-[#f4f1ed] hover:opacity-90",
    ghost: "text-[#5c4a32] hover:bg-[#f4f1ed]"
  };

  return (
    <button
      onClick={handleClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      <LogOut size={20} />
      Logout
    </button>
  );
} 