"use client";

import { useState } from "react";
import { Copy, Check, Code2, ShoppingBag, Globe } from "lucide-react";

interface Props {
  orgName: string;
  publicKey: string;
  appUrl: string;
}

export default function SnippetInstallPanel({ publicKey, appUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const snippetCode = `<script\n  src="${appUrl}/snippet.js"\n  data-key="${publicKey}"\n  async\n></script>`;

  function copy() {
    navigator.clipboard.writeText(snippetCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Key display */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Your public key</h2>
        <div className="flex items-center gap-3">
          <code className="flex-1 font-mono text-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-800">
            {publicKey}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(publicKey)}
            className="p-2.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Copy key"
          >
            <Copy size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This key is safe to embed publicly. It identifies your workspace — keep your account password private.
        </p>
      </div>

      {/* Snippet code */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Install snippet</h2>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">
          {snippetCode}
        </pre>
      </div>

      {/* Platform guides */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Installation guides</h2>
        <div className="space-y-4">
          <InstallGuide
            icon={<ShoppingBag size={18} className="text-green-600" />}
            title="Shopify"
            steps={[
              "Go to Online Store → Themes → Edit code",
              "Open theme.liquid",
              `Paste the snippet just before the closing </head> tag`,
              "Save — it deploys instantly",
            ]}
          />
          <InstallGuide
            icon={<Globe size={18} className="text-blue-600" />}
            title="Any website (HTML)"
            steps={[
              "Open your site's main HTML template",
              `Paste the snippet inside <head>`,
              "Publish your changes",
            ]}
          />
          <InstallGuide
            icon={<Code2 size={18} className="text-purple-600" />}
            title="Next.js / React"
            steps={[
              "Open your root layout or _document.js",
              `Add a <Script> component with strategy="afterInteractive"`,
              'Pass data-key as an attribute on the Script tag',
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function InstallGuide({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
      >
        {icon}
        <span className="text-sm font-medium text-gray-800">{title}</span>
        <span className="ml-auto text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ol className="px-4 pb-4 space-y-1.5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-600">
              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
