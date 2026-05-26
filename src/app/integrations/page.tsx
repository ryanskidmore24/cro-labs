"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Search,
  MousePointerClick,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Unplug,
} from "lucide-react";

interface IntegrationDef {
  type: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  connectUrl: string;
  fields?: { key: string; label: string; placeholder: string }[];
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    type: "GA4",
    name: "Google Analytics 4",
    description: "Track user navigation, funnels, traffic sources, and conversion data",
    icon: BarChart3,
    color: "bg-orange-500",
    connectUrl: "/api/auth/google?scope=ga4",
    fields: [{ key: "propertyId", label: "GA4 Property ID", placeholder: "e.g., 123456789" }],
  },
  {
    type: "SEARCH_CONSOLE",
    name: "Google Search Console",
    description: "See search queries, impressions, clicks, and keyword rankings",
    icon: Search,
    color: "bg-blue-500",
    connectUrl: "/api/auth/google?scope=search-console",
    fields: [{ key: "siteUrl", label: "Site URL", placeholder: "e.g., https://your-store.com" }],
  },
  {
    type: "CLARITY",
    name: "Microsoft Clarity",
    description: "Heatmaps, clickmaps, session recordings, and rage click detection",
    icon: MousePointerClick,
    color: "bg-purple-500",
    connectUrl: "",
    fields: [
      { key: "projectId", label: "Clarity Project ID", placeholder: "e.g., abc123def" },
      { key: "apiKey", label: "API Key", placeholder: "Your Clarity API key" },
    ],
  },
  {
    type: "SHOPIFY",
    name: "Shopify",
    description: "Order attribution, product data, and customer information",
    icon: ShoppingBag,
    color: "bg-green-600",
    connectUrl: "/api/auth/shopify",
    fields: [{ key: "shop", label: "Store Domain", placeholder: "e.g., your-store.myshopify.com" }],
  },
];

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    try {
      const res = await fetch("/api/integrations");
      const data = await res.json();
      const map: Record<string, any> = {};
      for (const c of data.integrations || []) {
        map[c.type] = c;
      }
      setConnections(map);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleConnect(integration: IntegrationDef) {
    if (integration.type === "CLARITY") {
      // Clarity uses API key, not OAuth — save directly
      const projectId = prompt("Enter your Clarity Project ID:");
      const apiKey = prompt("Enter your Clarity API Key:");
      if (!projectId || !apiKey) return;
      await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CLARITY", metadata: { projectId, apiKey } }),
      });
      await fetchConnections();
      return;
    }

    // For OAuth integrations, add userId param and redirect
    const url = new URL(integration.connectUrl, window.location.origin);
    if (integration.type === "SHOPIFY") {
      const shop = prompt("Enter your Shopify store domain (e.g., your-store.myshopify.com):");
      if (!shop) return;
      url.searchParams.set("shop", shop);
    }
    url.searchParams.set("userId", "current");
    window.location.href = url.toString();
  }

  async function handleDisconnect(type: string) {
    if (!confirm("Are you sure you want to disconnect this integration?")) return;
    await fetch(`/api/integrations?type=${type}`, { method: "DELETE" });
    await fetchConnections();
  }

  async function handleTestConnection(type: string) {
    setTesting(type);
    try {
      const res = await fetch(`/api/integrations/test?type=${type}`);
      const data = await res.json();
      alert(data.success ? "Connection successful!" : `Connection failed: ${data.error}`);
    } catch (e) {
      alert("Connection test failed");
    }
    setTesting(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Connect your data sources to power AI analysis and test tracking
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATIONS.map((integration) => {
          const conn = connections[integration.type];
          const connected = !!conn?.enabled;
          const Icon = integration.icon;

          return (
            <div key={integration.type} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${integration.color} rounded-lg flex items-center justify-center`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                    <p className="text-xs text-gray-500">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {connected ? (
                    <CheckCircle2 size={18} className="text-green-500" />
                  ) : (
                    <XCircle size={18} className="text-gray-300" />
                  )}
                </div>
              </div>

              {connected && (
                <div className="text-xs text-gray-500 mb-3 bg-gray-50 rounded p-2">
                  Connected {conn.updatedAt ? new Date(conn.updatedAt).toLocaleDateString() : ""}
                  {conn.metadata?.propertyId && ` · Property: ${conn.metadata.propertyId}`}
                  {conn.metadata?.shop && ` · Store: ${conn.metadata.shop}`}
                  {conn.metadata?.projectId && ` · Project: ${conn.metadata.projectId}`}
                </div>
              )}

              <div className="flex gap-2">
                {connected ? (
                  <>
                    <button
                      onClick={() => handleTestConnection(integration.type)}
                      disabled={testing === integration.type}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      {testing === integration.type ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ExternalLink size={12} />
                      )}
                      Test
                    </button>
                    <button
                      onClick={() => handleDisconnect(integration.type)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                    >
                      <Unplug size={12} /> Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(integration)}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
