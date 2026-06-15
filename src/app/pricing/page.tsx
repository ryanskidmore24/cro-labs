import Link from "next/link";
import { FlaskConical, CheckCircle2, ArrowRight } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: 0,
    description: "Perfect for getting started",
    features: ["3 active tests", "1 team seat", "Snippet tracking", "Basic A/B testing", "Community support"],
    cta: "Get started free",
    href: "/signup",
  },
  {
    name: "Pro",
    price: 49,
    description: "For growing ecommerce stores",
    features: ["25 active tests", "3 team seats", "AI hypothesis generation", "GA4 + Search Console", "Microsoft Clarity", "Shopify integration", "Email support"],
    cta: "Start Pro trial",
    href: "/signup",
    highlight: true,
  },
  {
    name: "Team",
    price: 149,
    description: "For serious CRO teams",
    features: ["Unlimited tests", "10 team seats", "Full AI suite (Claude + Gemini)", "Cross-platform analysis", "Priority support", "Custom integrations", "Advanced guardrails"],
    cta: "Start Team trial",
    href: "/signup",
  },
  {
    name: "Enterprise",
    price: null,
    description: "For large organizations",
    features: ["Unlimited everything", "Unlimited seats", "Custom SLA", "SSO / SAML", "Dedicated success manager", "On-premise option", "Custom contracts"],
    cta: "Contact us",
    href: "mailto:hello@crolab.app",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FlaskConical size={18} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">CRO Lab</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Sign in</Link>
            <Link href="/signup" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
        <p className="text-lg text-gray-500">Start free. Upgrade when you need more power.</p>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-2xl border p-6 flex flex-col ${
                plan.highlight ? "border-blue-500 shadow-xl shadow-blue-100" : "border-gray-200"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most popular</span>
                </div>
              )}
              <div className="mb-6">
                <h2 className="font-bold text-gray-900 text-lg mb-1">{plan.name}</h2>
                <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
                {plan.price === null ? (
                  <div className="text-3xl font-bold text-gray-900">Custom</div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-400 text-sm">/month</span>
                  </div>
                )}
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle2 size={15} className="text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {plan.cta} {plan.price !== null && <ArrowRight size={14} />}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-6">
            {[
              { q: "Can I switch plans later?", a: "Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades at the end of your billing period." },
              { q: "What happens to my data if I downgrade?", a: "Your data is always safe. If you exceed the free plan limits, you won't lose tests — you just won't be able to create new ones until you upgrade or archive existing ones." },
              { q: "Do you offer a trial?", a: "Yes — sign up for free and use the Free plan indefinitely. Paid plans include a 14-day trial when you first upgrade." },
              { q: "Is the snippet GDPR compliant?", a: "The snippet uses first-party cookies only and doesn't send data to third parties. You control all data stored in your CRO Lab account." },
              { q: "Does it work on Shopify?", a: "Yes. Paste the snippet in your theme.liquid file and it works across all Shopify storefronts. Shopify Plus and custom themes are fully supported." },
            ].map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl border border-gray-100 p-5">
                <p className="font-medium text-gray-900 mb-2">{faq.q}</p>
                <p className="text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-600">
            <FlaskConical size={16} />
            <span className="text-sm font-medium">CRO Lab</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
            <a href="mailto:hello@crolab.app" className="hover:text-gray-600 transition-colors">Contact</a>
            <Link href="/login" className="hover:text-gray-600 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
