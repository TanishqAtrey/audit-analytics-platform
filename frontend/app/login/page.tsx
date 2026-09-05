"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setStatus("loading");
    
    // Simulate API delay for animation
    setTimeout(() => {
      setStatus("success");
      localStorage.setItem("audit_user", username.trim());
      
      setTimeout(() => {
        router.push("/");
      }, 500);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-gray-100"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary mb-2">Audit Analytics Platform</h1>
          <p className="text-gray-500">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={status !== "idle"}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Enter your name"
              required
            />
          </div>

          <button
            type="submit"
            disabled={status !== "idle" || !username.trim()}
            className={cn(
              "w-full h-11 flex items-center justify-center rounded-lg font-medium transition-all duration-200",
              status === "success" 
                ? "bg-green-500 text-white" 
                : "bg-primary text-white hover:bg-primary-hover active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
            )}
          >
            {status === "idle" && <span>Sign In</span>}
            {status === "loading" && <Loader2 className="w-5 h-5 animate-spin" />}
            {status === "success" && <Check className="w-5 h-5" />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
