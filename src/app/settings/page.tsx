"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const storeId = "your-store-id"; // Would come from user context

  const snippetCode = `<!-- Conversion Path - Paste before </head> -->
<script
  src="https://your-app-domain.com/snippet.js"
  data-api="https://your-app-domain.com"
  data-store-id="${storeId}"
  defer
></script>`;

  function copySnippet() {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your CRO platform</p>
      </div>

      <div className="space-y-6">
        {/* Store Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Store Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
              <input
                type="text"
                placeholder="My Store"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store URL</label>
              <input
                type="url"
                placeholder="https://your-store.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option>America/New_York</option>
                <option>America/Chicago</option>
                <option>America/Denver</option>
                <option>America/Los_Angeles</option>
                <option>UTC</option>
              </select>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI API Keys</h2>
          <p className="text-sm text-gray-500 mb-4">
            These keys power the AI analysis engine. They are stored encrypted and never exposed.
          </p>
          <div className="space-y-4">
            {[
              { key: "anthropic", label: "Anthropic API Key (Claude)", placeholder: "sk-ant-..." },
              { key: "gemini", label: "Google Gemini API Key", placeholder: "AI..." },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys[key] ? "text" : "password"}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 pr-10"
                    />
                    <button
                      onClick={() => setShowKeys((s) => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Snippet Installation */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Snippet Installation</h2>
          <p className="text-sm text-gray-500 mb-4">
            Add this script to your Shopify theme to enable A/B testing on your storefront.
            Go to Online Store → Themes → Edit code → theme.liquid and paste before the closing
            &lt;/head&gt; tag.
          </p>
          <div className="relative">
            <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto font-mono">
              {snippetCode}
            </pre>
            <button
              onClick={copySnippet}
              className="absolute top-2 right-2 p-2 bg-gray-700 rounded-md hover:bg-gray-600 text-gray-300"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Auto-promotion Defaults */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Auto-Promotion Defaults</h2>
          <p className="text-sm text-gray-500 mb-4">
            When enabled per-test, winners will be auto-promoted if they meet these criteria.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Probability Threshold
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={95}
                  min={80}
                  max={99}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Sample Size
              </label>
              <input
                type="number"
                defaultValue={1000}
                min={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Run Days
              </label>
              <input
                type="number"
                defaultValue={7}
                min={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Notifications</h2>
          <div className="space-y-3">
            {[
              { label: "Test reaches significance", defaultChecked: true },
              { label: "Guardrail violation detected", defaultChecked: true },
              { label: "Traffic anomaly (sudden drop)", defaultChecked: true },
              { label: "Auto-promotion executed", defaultChecked: true },
              { label: "Weekly digest of all tests", defaultChecked: false },
            ].map(({ label, defaultChecked }) => (
              <label key={label} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">{label}</span>
                <input
                  type="checkbox"
                  defaultChecked={defaultChecked}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            ))}
          </div>
        </div>

        <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Save All Settings
        </button>
      </div>
    </div>
  );
}
