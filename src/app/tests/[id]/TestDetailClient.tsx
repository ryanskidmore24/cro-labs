"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import BayesianGauge from "@/components/dashboard/BayesianGauge";
import {
  Play,
  Pause,
  Archive,
  ExternalLink,
  PanelLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TestDetailClientProps {
  test: any;
  eventCounts: any[];
  dailyEvents: any[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "neutral",
  QUEUED: "info",
  RUNNING: "warning",
  COMPLETED: "success",
  SHIPPED: "success",
  ARCHIVED: "neutral",
};

export default function TestDetailClient({
  test,
  eventCounts,
  dailyEvents,
}: TestDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"results" | "variants" | "settings" | "history">("results");

  // Build daily chart data
  const chartData = buildChartData(dailyEvents, test.variants);

  // Get latest results per variant
  const latestResults = test.variants.map((v: any) => {
    const result = test.results.find((r: any) => r.variantId === v.id);
    const impressions = eventCounts.find(
      (e: any) => e.variantId === v.id && e.eventType === "IMPRESSION"
    )?._count ?? 0;
    const conversions = eventCounts.find(
      (e: any) => e.variantId === v.id && e.eventType === "CONVERSION"
    )?._count ?? 0;
    return { ...v, result, impressions, conversions };
  });

  const controlVariant = latestResults.find((v: any) => v.isControl);
  const testVariants = latestResults.filter((v: any) => !v.isControl);
  const bestVariant = testVariants.reduce(
    (best: any, v: any) =>
      (v.result?.bayesianProbability ?? 0) > (best?.result?.bayesianProbability ?? 0) ? v : best,
    testVariants[0]
  );

  const tabs = [
    { key: "results", label: "Results" },
    { key: "variants", label: "Variants" },
    { key: "settings", label: "Settings" },
    { key: "history", label: "History" },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/tests" className="hover:text-blue-600">Tests</Link>
            <ChevronRight size={14} />
            <span className="text-gray-700">{test.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{test.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={STATUS_COLORS[test.status] as any}>{test.status}</Badge>
            <span className="text-sm text-gray-500">{test.targetUrl}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {test.status === "RUNNING" ? (
            <button className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <Pause size={14} /> Pause
            </button>
          ) : test.status === "DRAFT" || test.status === "QUEUED" ? (
            <button className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Play size={14} /> Launch
            </button>
          ) : null}
          <Link
            href={`/builder?testId=${test.id}&url=${encodeURIComponent(test.targetUrl)}`}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <PanelLeft size={14} /> Edit in Builder
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results Tab */}
      {activeTab === "results" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {bestVariant?.result && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4">
                <BayesianGauge probability={bestVariant.result.bayesianProbability} size={80} />
                <div>
                  <div className="text-sm text-gray-500">Chance of Winning</div>
                  <div className="text-lg font-bold text-gray-900">
                    {(bestVariant.result.bayesianProbability * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-400">{bestVariant.name}</div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="text-sm text-gray-500 mb-1">Conversion Lift</div>
                <div className="flex items-center gap-2">
                  {bestVariant.result.liftPercent >= 0 ? (
                    <TrendingUp size={20} className="text-green-500" />
                  ) : (
                    <TrendingDown size={20} className="text-red-500" />
                  )}
                  <span className={`text-2xl font-bold ${bestVariant.result.liftPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {bestVariant.result.liftPercent >= 0 ? "+" : ""}
                    {bestVariant.result.liftPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  CI: [{bestVariant.result.credibleIntervalLow.toFixed(2)}%, {bestVariant.result.credibleIntervalHigh.toFixed(2)}%]
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="text-sm text-gray-500 mb-1">Total Impressions</div>
                <div className="text-2xl font-bold text-gray-900">
                  {latestResults.reduce((s: number, v: any) => s + v.impressions, 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {latestResults.reduce((s: number, v: any) => s + v.conversions, 0).toLocaleString()} conversions
                </div>
              </div>
            </div>
          )}

          {/* Metrics Table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Variant Comparison</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left py-3 px-4">Variant</th>
                  <th className="text-right py-3 px-4">Impressions</th>
                  <th className="text-right py-3 px-4">Conversions</th>
                  <th className="text-right py-3 px-4">CVR</th>
                  <th className="text-right py-3 px-4">Lift</th>
                  <th className="text-right py-3 px-4">Probability</th>
                </tr>
              </thead>
              <tbody>
                {latestResults.map((v: any) => {
                  const cvr = v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0;
                  return (
                    <tr key={v.id} className="border-b border-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{v.name}</span>
                        {v.isControl && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            Control
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-sm">{v.impressions.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-sm">{v.conversions.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-sm font-medium">{cvr.toFixed(2)}%</td>
                      <td className="py-3 px-4 text-right text-sm">
                        {v.result?.liftPercent != null ? (
                          <span className={v.result.liftPercent >= 0 ? "text-green-600" : "text-red-500"}>
                            {v.result.liftPercent >= 0 ? "+" : ""}{v.result.liftPercent.toFixed(2)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {v.result?.bayesianProbability != null ? (
                          <BayesianGauge probability={v.result.bayesianProbability} size={40} />
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Conversion Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Conversions Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {test.variants.map((v: any, i: number) => (
                    <Line
                      key={v.id}
                      type="monotone"
                      dataKey={v.name}
                      stroke={v.isControl ? "#9ca3af" : ["#3b82f6", "#8b5cf6", "#f59e0b"][i % 3]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Guardrails */}
          {test.guardrails.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Guardrail Metrics</h3>
              <div className="space-y-2">
                {test.guardrails.map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">
                      {g.customName || g.metric.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {g.operator} {g.threshold}
                      </span>
                      <CheckCircle2 size={16} className="text-green-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Variants Tab */}
      {activeTab === "variants" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {test.variants.map((v: any) => (
            <div key={v.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-medium text-gray-900">{v.name}</span>
                  {v.isControl && (
                    <Badge variant="neutral" size="sm" className="ml-2">Control</Badge>
                  )}
                </div>
                <span className="text-sm text-gray-500">{v.trafficWeight}% traffic</span>
              </div>
              {v.domChanges && Array.isArray(v.domChanges) && v.domChanges.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">
                    {v.domChanges.length} change(s)
                  </p>
                  {v.domChanges.slice(0, 5).map((change: any, i: number) => (
                    <div key={i} className="text-xs bg-gray-50 rounded p-2 font-mono text-gray-600">
                      {change.action}: {change.selector}
                    </div>
                  ))}
                  {v.domChanges.length > 5 && (
                    <p className="text-xs text-gray-400">+{v.domChanges.length - 5} more</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  {v.isControl ? "Original page (no changes)" : "No changes defined yet"}
                </p>
              )}
              {!v.isControl && (
                <Link
                  href={`/builder?testId=${test.id}&url=${encodeURIComponent(test.targetUrl)}&variantId=${v.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <PanelLeft size={14} /> Edit in Builder
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
          <h3 className="font-semibold text-gray-900 mb-4">Test Configuration</h3>
          <div className="space-y-4 text-sm">
            <div>
              <label className="text-gray-500 block mb-1">Hypothesis</label>
              <p className="text-gray-900 italic">{test.hypothesis || "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-500 block mb-1">Primary KPI</label>
                <p className="font-medium">{test.primaryKpi.replace(/_/g, " ")}</p>
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Device Target</label>
                <p className="font-medium">{test.deviceTarget}</p>
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Traffic Allocation</label>
                <p className="font-medium">{test.trafficPercent}%</p>
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Effort Estimate</label>
                <p className="font-medium">{test.effortEstimate || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Test History</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Clock size={14} className="text-gray-400" />
              <span className="text-gray-500">Created</span>
              <span className="text-gray-900">
                {new Date(test.createdAt).toLocaleDateString()} by {test.owner?.name || "Unknown"}
              </span>
            </div>
            {test.startedAt && (
              <div className="flex items-center gap-3 text-sm">
                <Play size={14} className="text-green-500" />
                <span className="text-gray-500">Started</span>
                <span className="text-gray-900">{new Date(test.startedAt).toLocaleDateString()}</span>
              </div>
            )}
            {test.endedAt && (
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 size={14} className="text-blue-500" />
                <span className="text-gray-500">Ended</span>
                <span className="text-gray-900">{new Date(test.endedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: build daily chart data from events
function buildChartData(events: any[], variants: any[]) {
  const byDay: Record<string, Record<string, number>> = {};
  for (const evt of events) {
    if (evt.eventType !== "CONVERSION") continue;
    const day = new Date(evt.createdAt).toISOString().slice(0, 10);
    const variant = variants.find((v: any) => v.id === evt.variantId);
    if (!variant) continue;
    if (!byDay[day]) byDay[day] = {};
    byDay[day][variant.name] = (byDay[day][variant.name] || 0) + 1;
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));
}
