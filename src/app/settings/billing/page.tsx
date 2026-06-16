"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Zap, Users, Building2, ExternalLink } from "lucide-react";

const PLANS = [
  {
    key: "FREE",
    name: "Free",
    price: 0,
    description: "Get started with A/B testing",
    features: ["3 active tests", "1 seat", "Basic analytics", "Snippet tracking"],
    cta: "Current plan",
  },
  {
    key: "PRO",
    name: "Pro",
    price: 49,
    description: "For growing stores",
    features: ["25 active tests", "3 seats", "AI hypothesis generation", "Priority support"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    key: "TEAM",
    name: "Team",
    price: 149,
    description: "For serious optimization teams",
    features: ["Unlimited tests", "10 seats", "Full AI suite", "Custom integrations", "Dedicated support"],
    cta: "Upgrade to Team",
  },
  {
    key: "ENTERPRISE",
    name: "Enterprise",
    price: null,
    description: "For large organizations",
    features: ["Unlimited everything", "Unlimited seats", "Custom SLA", "SSO / SAML", "On-prem option"],
    cta: "Contact us",
  },
];

export default function BillingPage() {
  const [org, setOrg] = useState<{ plan: string; subscriptionStatus: string | null; subscriptionPeriodEnd: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.org) setOrg(d.org);
    });
  }, []);

  async function checkout(plan: string) {
    setActionLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setActionLoading(null);
    }
  }

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  const currentPlan = org?.plan ?? "FREE";

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your plan and billing details</p>
        </div>
        {currentPlan !== "FREE" && (
          <button
            onClick={openPortal}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={14} /> Manage billing
          </button>
        )}
      </div>

      {org?.subscriptionStatus && org.subscriptionStatus !== "active" && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Your subscription status is <strong>{org.subscriptionStatus}</strong>.
          {org.subscriptionPeriodEnd && ` Access ends ${new Date(org.subscriptionPeriodEnd).toLocaleDateString()}.`}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          return (
            <div
              key={plan.key}
              className={`relative bg-white rounded-xl border p-5 flex flex-col ${
                plan.highlight ? "border-blue-500 shadow-md" : "border-gray-200"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most popular</span>
                </div>
              )}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  {plan.key === "FREE" && <Zap size={16} className="text-gray-400" />}
                  {plan.key === "PRO" && <Zap size={16} className="text-blue-600" />}
                  {plan.key === "TEAM" && <Users size={16} className="text-purple-600" />}
                  {plan.key === "ENTERPRISE" && <Building2 size={16} className="text-gray-700" />}
                  <span className="font-semibold text-gray-900">{plan.name}</span>
                </div>
                <div className="mt-2">
                  {plan.price === null ? (
                    <span className="text-2xl font-bold text-gray-900">Custom</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-sm text-gray-500">/mo</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
              </div>

              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="text-center py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg">
                  Current plan
                </div>
              ) : plan.key === "ENTERPRISE" ? (
                <a
                  href="mailto:hello@conversionpath.com"
                  className="text-center py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Contact us
                </a>
              ) : (
                <button
                  onClick={() => checkout(plan.key)}
                  disabled={actionLoading === plan.key}
                  className={`py-2 text-sm font-medium rounded-lg transition-colors ${
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  } disabled:opacity-50`}
                >
                  {actionLoading === plan.key ? "Redirecting..." : plan.cta}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
