"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, CheckCircle2, Code2, Plug, ArrowRight } from "lucide-react";

type OrgData = { name: string; publicKey: string; id: string } | null;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [org, setOrg] = useState<OrgData>(null);
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.org) {
          setOrg(d.org);
          setOrgName(d.org.name);
        }
      });
  }, []);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "";

  const snippetCode = org
    ? `<script\n  src="${appUrl}/snippet.js"\n  data-key="${org.publicKey}"\n  async\n></script>`
    : "";

  async function saveOrgName() {
    if (!orgName.trim()) return;
    setSaving(true);
    await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName }),
    });
    setSaving(false);
    setStep(2);
  }

  function copySnippet() {
    navigator.clipboard.writeText(snippetCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FlaskConical size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 1 && "Welcome! Let's get you set up."}
            {step === 2 && "Install the tracking snippet"}
            {step === 3 && "You're ready!"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Step {step} of 3
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                s <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {/* Step 1: Workspace name */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace name
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  This is how your team sees your account — usually your company or brand name.
                </p>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Store"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={saveOrgName}
                disabled={saving || !orgName.trim()}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? "Saving..." : <>Continue <ArrowRight size={16} /></>}
              </button>
            </div>
          )}

          {/* Step 2: Snippet install */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Code2 size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  Paste this snippet into the <code className="font-mono bg-blue-100 px-1 rounded">&lt;head&gt;</code> of every page on your site.
                  On Shopify, add it to your <strong>theme.liquid</strong> file.
                </div>
              </div>

              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto font-mono">
                  {snippetCode}
                </pre>
                <button
                  onClick={copySnippet}
                  className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Your unique key: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{org?.publicKey}</code>
                <br />
                You can always find this in <strong>Settings → Snippet</strong>.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                >
                  I&apos;ve installed it <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">All set!</h3>
                <p className="text-sm text-gray-500">
                  Your workspace is ready. Next, connect your analytics integrations to start detecting friction and generating AI-powered hypotheses.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => router.push("/integrations")}
                  className="py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <Plug size={16} />
                  Connect integrations
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                >
                  Go to dashboard <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
