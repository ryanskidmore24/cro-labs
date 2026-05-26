"use client";

import { useState, useEffect } from "react";
import InsightCard from "@/components/dashboard/InsightCard";
import { Brain, Search, Loader2, Sparkles, RefreshCw } from "lucide-react";

export default function InsightsPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

  useEffect(() => {
    fetchSignals();
  }, []);

  async function fetchSignals() {
    setLoading(true);
    try {
      const res = await fetch("/api/insights");
      const data = await res.json();
      setSignals(data.signals || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function runFullAnalysis() {
    setAnalyzing(true);
    try {
      await fetch("/api/ai/analyze", { method: "POST" });
      await fetchSignals();
    } catch (e) {
      console.error(e);
    }
    setAnalyzing(false);
  }

  async function handleGenerateHypotheses(signalId: string) {
    try {
      const res = await fetch("/api/ai/hypothesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId }),
      });
      const data = await res.json();
      setSignals((prev) =>
        prev.map((s) => (s.id === signalId ? { ...s, hypotheses: data.hypotheses } : s))
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateTest(hypothesisId: string) {
    window.location.href = `/tests/new?hypothesisId=${hypothesisId}`;
  }

  async function handleQuery() {
    if (!query.trim()) return;
    setQuerying(true);
    setQueryResult(null);
    try {
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setQueryResult(data.answer);
    } catch (e) {
      setQueryResult("Sorry, I couldn't process that query. Please try again.");
    }
    setQuerying(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-detected friction signals and test suggestions
          </p>
        </div>
        <button
          onClick={runFullAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {analyzing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {analyzing ? "Analyzing..." : "Run Full Analysis"}
        </button>
      </div>

      {/* Natural Language Query */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-700">Ask about your store data</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              placeholder="e.g., What page has the highest mobile drop-off this week?"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleQuery}
            disabled={querying || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
          >
            {querying ? <Loader2 size={16} className="animate-spin" /> : "Ask"}
          </button>
        </div>
        {queryResult && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-gray-800 whitespace-pre-wrap">
            {queryResult}
          </div>
        )}
      </div>

      {/* Friction Signals */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : signals.length > 0 ? (
        <div className="space-y-3">
          {signals.map((signal) => (
            <InsightCard
              key={signal.id}
              id={signal.id}
              pageUrl={signal.pageUrl}
              signalType={signal.signalType}
              severity={signal.severity}
              metric={signal.metric}
              baseline={signal.baseline}
              detectedAt={signal.detectedAt}
              hypotheses={signal.hypotheses}
              onGenerateHypotheses={handleGenerateHypotheses}
              onCreateTest={handleCreateTest}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Brain size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No friction signals yet</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Connect your integrations (GA4, Clarity, Search Console) and run a full analysis
            to detect friction points on your store.
          </p>
          <button
            onClick={runFullAnalysis}
            disabled={analyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Run First Analysis
          </button>
        </div>
      )}
    </div>
  );
}
