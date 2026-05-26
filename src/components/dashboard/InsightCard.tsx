"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";
import {
  ChevronDown,
  ChevronUp,
  Zap,
  MousePointerClick,
  FormInput,
  Gauge,
  ArrowUpRight,
  FlaskConical,
} from "lucide-react";

const SIGNAL_ICONS: Record<string, React.ElementType> = {
  HIGH_DROPOFF: ArrowUpRight,
  LOW_CTR: MousePointerClick,
  FORM_ABANDONMENT: FormInput,
  RAGE_CLICK: Zap,
  SLOW_LOAD: Gauge,
  HIGH_BOUNCE: ArrowUpRight,
};

const SEVERITY_VARIANT: Record<string, "error" | "warning" | "info" | "neutral"> = {
  CRITICAL: "error",
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "info",
};

interface InsightCardProps {
  id: string;
  pageUrl: string;
  signalType: string;
  severity: string;
  metric: number;
  baseline: number;
  detectedAt: string;
  hypotheses?: {
    id: string;
    suggestedChange: string;
    predictedLift: number;
    effort: string;
  }[];
  onGenerateHypotheses?: (signalId: string) => void;
  onCreateTest?: (hypothesisId: string) => void;
}

export default function InsightCard({
  id,
  pageUrl,
  signalType,
  severity,
  metric,
  baseline,
  detectedAt,
  hypotheses,
  onGenerateHypotheses,
  onCreateTest,
}: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = SIGNAL_ICONS[signalType] || Zap;
  const change = baseline > 0 ? ((metric - baseline) / baseline) * 100 : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant={SEVERITY_VARIANT[severity] || "neutral"} size="sm">
              {severity}
            </Badge>
            <span className="text-xs text-gray-500">
              {signalType.replace(/_/g, " ")}
            </span>
          </div>
          <div className="text-sm font-medium text-gray-900 truncate">{pageUrl}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {metric.toFixed(1)}% vs {baseline.toFixed(1)}% baseline ({change >= 0 ? "+" : ""}
            {change.toFixed(1)}%) &middot; Detected{" "}
            {new Date(detectedAt).toLocaleDateString()}
          </div>
        </div>
        <div className="flex-shrink-0 text-gray-400">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {hypotheses && hypotheses.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                AI-Generated Hypotheses
              </h4>
              {hypotheses.map((h) => (
                <div
                  key={h.id}
                  className="bg-white rounded-md border border-gray-200 p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{h.suggestedChange}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-green-600 font-medium">
                        +{h.predictedLift.toFixed(1)}% predicted lift
                      </span>
                      <Badge variant="neutral" size="sm">
                        {h.effort} effort
                      </Badge>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateTest?.(h.id);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 flex-shrink-0"
                  >
                    <FlaskConical size={12} /> Create Test
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">
                No hypotheses generated yet for this signal.
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateHypotheses?.(id);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Generate Hypotheses with AI
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
