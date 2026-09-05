"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  LayoutDashboard,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  Gauge,
  Clock,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

const NAV_ITEMS = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Visualization", href: "/dashboard", icon: BarChart3 },
  { label: "Ledger Analysis", href: "/ledger", icon: FileSpreadsheet },
  { label: "Financial Statements", href: "/financial", icon: TrendingUp },
  { label: "Performance Metrics", href: "/metrics", icon: Gauge },
  { label: "History", href: "/history", icon: Clock },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    setUsername(localStorage.getItem("audit_user") || "Guest");
  }, []);

  const closeSidebar = () => {
    if (!isDesktop) setIsOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar border-r border-card-border w-[260px] text-gray-900 shadow-sm">
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Audit Analytics</h1>
        {!isDesktop && (
          <button onClick={closeSidebar} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors overflow-hidden",
                isActive
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon size={20} className={cn(isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700")} />
              <span className="font-medium z-10">{item.label}</span>
              
              {!isActive && (
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary/20 transition-all duration-300 group-hover:w-full" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-sm text-gray-500 font-medium">Logged in as</div>
        <div className="text-sm font-semibold truncate text-gray-800">{username}</div>
      </div>
    </div>
  );

  return (
    <>
      {!isDesktop && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-40 p-2 bg-white rounded-md shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          <Menu size={24} />
        </button>
      )}

      {isDesktop ? (
        <div className="sticky top-0 h-screen hidden lg:block z-30">
          {sidebarContent}
        </div>
      ) : (
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeSidebar}
                className="fixed inset-0 bg-black/40 z-40 modal-backdrop-blur"
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="fixed inset-y-0 left-0 z-50 shadow-xl bg-white"
              >
                {sidebarContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </>
  );
}
