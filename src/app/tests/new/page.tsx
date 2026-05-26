"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PanelLeft,
  FlaskConical,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const KPIS = ["CVR", "REVENUE", "AOV", "SUBSCRIPTION_RATE", "CUSTOM"];
const DEVICES = ["ALL", "MOBILE", "DESKTOP", "TABLET"];
const EFFORTS = ["LOW", "MEDIUM", "HIGH"];

interface TestDraft {
  name: string;
  targetUrl: string;
  description: string;
  change: string;
  outcome: string;
  reasoning: string;
  primaryKpi: string;
  guardrails: string;
  deviceTarget: string;
  trafficPercent: number;
  effortEstimate: string;
}

export default function NewTestPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<TestDraft>({
    name: "",
    targetUrl: "",
    description: "",
    change: "",
    outcome: "",
    reasoning: "",
    primaryKpi: "CVR",
    guardrails: "",
    deviceTarget: "ALL",
    trafficPercent: 100,
    effortEstimate: "MEDIUM",
  });

  const update = (field: keyof TestDraft, value: string | number) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const canProceed: Record<Step, boolean> = {
    1: draft.name.length > 0 && draft.targetUrl.length > 0,
    2: draft.change.length > 0 && draft.outcome.length > 0,
    3: true,
    4: true,
  };

  const handleSave = async (openBuilder: boolean) => {
    setSaving(true);
    try {
      const hypothesis = `We believe that ${draft.change} will ${draft.outcome} because ${draft.reasoning}, measured by ${draft.primaryKpi}${draft.guardrails ? ` with ${draft.guardrails} held flat` : ""}.`;
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          targetUrl: draft.targetUrl,
          description: draft.description,
          hypothesis,
          primaryKpi: draft.primaryKpi,
          deviceTarget: draft.deviceTarget,
          trafficPercent: draft.trafficPercent,
          effortEstimate: draft.effortEstimate,
        }),
      });
      const data = await res.json();
      if (openBuilder) {
        router.push(`/builder?testId=${data.id}&url=${encodeURIComponent(draft.targetUrl)}`);
      } else {
        router.push(`/tests/${data.id}`);
      }
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s < step
                  ? "bg-blue-600 text-white"
                  : s === step
                  ? "bg-blue-100 text-blue-600 ring-2 ring-blue-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {s < step ? <Check size={14} /> : s}
            </div>
            {s < 4 && (
              <div
                className={`flex-1 h-0.5 ${
                  s < step ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Basic Information</h2>
            <p className="text-sm text-gray-500 mb-6">Name your test and set the target page</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g., Homepage hero CTA color test"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target URL</label>
                <input
                  type="url"
                  value={draft.targetUrl}
                  onChange={(e) => update("targetUrl", e.target.value)}
                  placeholder="https://your-store.com/page-to-test"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="What are you trying to learn from this test?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Hypothesis */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Hypothesis</h2>
            <p className="text-sm text-gray-500 mb-4">
              Structure your prediction so results are interpretable
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6 text-sm text-blue-800">
              We believe that <strong>[change]</strong> will <strong>[outcome]</strong> because{" "}
              <strong>[reasoning]</strong>, measured by <strong>[KPI]</strong> with{" "}
              <strong>[guardrails]</strong> held flat.
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What change are you making?</label>
                <input
                  type="text"
                  value={draft.change}
                  onChange={(e) => update("change", e.target.value)}
                  placeholder="e.g., making the Add to Cart button larger and green"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What outcome do you predict?</label>
                <input
                  type="text"
                  value={draft.outcome}
                  onChange={(e) => update("outcome", e.target.value)}
                  placeholder="e.g., increase add-to-cart rate by 10-15%"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Why? (reasoning)</label>
                <textarea
                  value={draft.reasoning}
                  onChange={(e) => update("reasoning", e.target.value)}
                  placeholder="e.g., heatmap data shows users scroll past the current CTA without clicking"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary KPI</label>
                  <select
                    value={draft.primaryKpi}
                    onChange={(e) => update("primaryKpi", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {KPIS.map((k) => (
                      <option key={k} value={k}>
                        {k.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effort Estimate</label>
                  <select
                    value={draft.effortEstimate}
                    onChange={(e) => update("effortEstimate", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {EFFORTS.map((e) => (
                      <option key={e} value={e}>
                        {e.charAt(0) + e.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guardrail Metrics (optional)</label>
                <input
                  type="text"
                  value={draft.guardrails}
                  onChange={(e) => update("guardrails", e.target.value)}
                  placeholder="e.g., AOV and cart abandonment rate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Targeting */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Audience Targeting</h2>
            <p className="text-sm text-gray-500 mb-6">Configure who sees this test</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Device Target</label>
                <div className="flex gap-2">
                  {DEVICES.map((d) => (
                    <button
                      key={d}
                      onClick={() => update("deviceTarget", d)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        draft.deviceTarget === d
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {d.charAt(0) + d.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Traffic Allocation: {draft.trafficPercent}%
                </label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={draft.trafficPercent}
                  onChange={(e) => update("trafficPercent", Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>5%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Review & Create</h2>
            <p className="text-sm text-gray-500 mb-6">Confirm your test configuration</p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Name</span>
                <span className="font-medium text-gray-900">{draft.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">URL</span>
                <span className="font-medium text-gray-900 truncate max-w-[300px]">{draft.targetUrl}</span>
              </div>
              <div className="py-2 border-b border-gray-100">
                <span className="text-gray-500 block mb-1">Hypothesis</span>
                <p className="text-gray-900 italic">
                  &ldquo;We believe that {draft.change} will {draft.outcome}
                  {draft.reasoning ? ` because ${draft.reasoning}` : ""}, measured
                  by {draft.primaryKpi.replace(/_/g, " ")}
                  {draft.guardrails ? ` with ${draft.guardrails} held flat` : ""}.&rdquo;
                </p>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Device</span>
                <span className="font-medium">{draft.deviceTarget}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Traffic</span>
                <span className="font-medium">{draft.trafficPercent}%</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Effort</span>
                <span className="font-medium">{draft.effortEstimate}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <div />
          )}
          {step < 4 ? (
            <button
              disabled={!canProceed[step]}
              onClick={() => setStep((s) => (s + 1) as Step)}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <FlaskConical size={14} className="inline mr-1" />
                Save as Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
              >
                <PanelLeft size={14} className="inline mr-1" />
                Open in Builder
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
