"use client";

import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const user = localStorage.getItem("audit_user");
    if (!user && pathname !== "/login") {
      router.push("/login");
    } else {
      setIsAuthenticated(true);
    }
  }, [pathname, router]);

  const isLoginPage = pathname === "/login";

  return (
    <html lang="en">
      <head>
        <title>Audit Analytics Platform</title>
      </head>
      <body className="min-h-screen bg-white flex font-sans antialiased text-gray-900">
        {isClient && !isLoginPage && isAuthenticated && <Sidebar />}
        <main className={`flex-1 overflow-x-hidden ${!isLoginPage ? "p-4 lg:p-8" : ""}`}>
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
