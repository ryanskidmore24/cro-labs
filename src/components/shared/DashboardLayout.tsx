"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  Lightbulb,
  PanelLeft,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  ListChecks,
  CheckCircle2,
  Archive,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Tests",
    href: "/tests",
    icon: FlaskConical,
    children: [
      { label: "Active", href: "/tests?status=RUNNING", icon: FlaskConical },
      { label: "Backlog", href: "/tests?status=QUEUED", icon: ListChecks },
      { label: "Completed", href: "/tests?status=COMPLETED", icon: CheckCircle2 },
      { label: "Archived", href: "/tests?status=ARCHIVED", icon: Archive },
    ],
  },
  {
    label: "Insights",
    href: "/insights",
    icon: Lightbulb,
  },
  {
    label: "Builder",
    href: "/builder",
    icon: PanelLeft,
  },
  {
    label: "Integrations",
    href: "/integrations",
    icon: Plug,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href.includes("?")) return pathname === href.split("?")[0];
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-60"
        } bg-gray-900 text-white flex flex-col transition-all duration-200 flex-shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-800">
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight">CRO Lab</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <div key={item.href}>
              {item.children ? (
                <>
                  <button
                    onClick={() =>
                      setExpandedGroup(
                        expandedGroup === item.label ? null : item.label
                      )
                    }
                    className={`flex items-center w-full px-4 py-2.5 text-sm transition-colors ${
                      isActive(item.href)
                        ? "bg-gray-800 text-white"
                        : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                    }`}
                  >
                    <item.icon size={18} className="flex-shrink-0" />
                    {!collapsed && (
                      <span className="ml-3 truncate">{item.label}</span>
                    )}
                  </button>
                  {!collapsed && expandedGroup === item.label && (
                    <div className="ml-4 border-l border-gray-700">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center px-4 py-2 text-xs transition-colors ${
                            pathname.includes(child.href.split("?")[1]?.split("=")[1] || "___")
                              ? "text-white bg-gray-800/50"
                              : "text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          <child.icon size={14} className="flex-shrink-0" />
                          <span className="ml-2">{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-2.5 text-sm transition-colors ${
                    isActive(item.href)
                      ? "bg-gray-800 text-white border-r-2 border-blue-500"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-3 truncate">{item.label}</span>
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-800 p-3">
          <button className="flex items-center w-full px-2 py-2 text-sm text-gray-400 hover:text-white rounded hover:bg-gray-800">
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span className="ml-3">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search tests, pages, insights..."
                className="pl-9 pr-4 py-1.5 bg-gray-100 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              R
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
