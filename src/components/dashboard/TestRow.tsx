"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import BayesianGauge from "./BayesianGauge";
import { MoreHorizontal, ExternalLink, Pause, Trash2 } from "lucide-react";
import { useState } from "react";

type TestStatus = "DRAFT" | "QUEUED" | "RUNNING" | "COMPLETED" | "SHIPPED" | "ARCHIVED";

const STATUS_VARIANT: Record<TestStatus, "neutral" | "info" | "success" | "warning" | "error"> = {
  DRAFT: "neutral",
  QUEUED: "info",
  RUNNING: "warning",
  COMPLETED: "success",
  SHIPPED: "success",
  ARCHIVED: "neutral",
};

interface TestRowProps {
  id: string;
  name: string;
  status: TestStatus;
  primaryKpi: string;
  probability?: number;
  revenueLift?: number;
  startedAt?: string | null;
  targetUrl?: string;
}

export default function TestRow({
  id,
  name,
  status,
  primaryKpi,
  probability,
  revenueLift,
  startedAt,
  targetUrl,
}: TestRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const duration = startedAt
    ? Math.ceil(
        (Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <Link href={`/tests/${id}`} className="font-medium text-gray-900 hover:text-blue-600">
          {name}
        </Link>
        <div className="text-xs text-gray-500 truncate max-w-[200px]">{targetUrl}</div>
      </td>
      <td className="py-3 px-4">
        <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">{primaryKpi.replace("_", " ")}</td>
      <td className="py-3 px-4">
        {probability != null ? (
          <BayesianGauge probability={probability} size={48} />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        {revenueLift != null ? (
          <span className={revenueLift >= 0 ? "text-green-600 font-medium text-sm" : "text-red-500 font-medium text-sm"}>
            {revenueLift >= 0 ? "+" : ""}
            {revenueLift.toFixed(1)}%
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">
        {duration != null ? `${duration}d` : "—"}
      </td>
      <td className="py-3 px-4 relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded hover:bg-gray-200 text-gray-400"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-4 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40">
              <Link
                href={`/tests/${id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <ExternalLink size={14} /> View details
              </Link>
              <button className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left">
                <Pause size={14} /> Pause test
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                <Trash2 size={14} /> Archive
              </button>
            </div>
          </>
        )}
      </td>
    </tr>
  );
}
