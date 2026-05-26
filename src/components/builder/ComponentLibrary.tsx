'use client';

import React, { useState } from 'react';
import {
  ShoppingCart,
  Shield,
  Clock,
  Star,
  MessageSquare,
  BarChart3,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Megaphone,
  HelpCircle,
  Gift,
  Truck,
  X as XIcon,
  ArrowUpRight,
} from 'lucide-react';
import type { ComponentTemplate, ComponentCategory, ComponentProp } from './types';

// ============================================================
// Pre-built CRO component templates
// ============================================================

export const CRO_COMPONENTS: ComponentTemplate[] = [
  // ---- Conversion ----
  {
    id: 'sticky-cta',
    name: 'Sticky CTA Bar',
    description: 'A fixed bar at the bottom of the viewport with a prominent call-to-action button.',
    category: 'conversion',
    expectedLift: '+4-9%',
    thumbnail: '',
    configurableProps: [
      { name: 'text', label: 'Button Text', type: 'text', defaultValue: 'Add to Cart' },
      { name: 'bgColor', label: 'Background', type: 'color', defaultValue: '#111827' },
      { name: 'btnColor', label: 'Button Color', type: 'color', defaultValue: '#2563eb' },
      { name: 'btnTextColor', label: 'Button Text Color', type: 'color', defaultValue: '#ffffff' },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:${p.bgColor};padding:12px 24px;display:flex;align-items:center;justify-content:center;gap:16px;box-shadow:0 -2px 10px rgba(0,0,0,.15);">
        <button style="background:${p.btnColor};color:${p.btnTextColor};border:none;padding:12px 32px;border-radius:6px;font-size:16px;font-weight:600;cursor:pointer;">${p.text}</button>
      </div>`,
  },
  {
    id: 'exit-intent',
    name: 'Exit Intent Overlay',
    description: 'A modal overlay triggered when the user moves to leave the page, offering a discount or lead capture.',
    category: 'conversion',
    expectedLift: '+5-12%',
    thumbnail: '',
    configurableProps: [
      { name: 'headline', label: 'Headline', type: 'text', defaultValue: 'Wait! Before you go...' },
      { name: 'offer', label: 'Offer Text', type: 'text', defaultValue: 'Get 10% off your first order' },
      { name: 'btnText', label: 'Button Text', type: 'text', defaultValue: 'Claim My Discount' },
      { name: 'bgColor', label: 'Overlay Background', type: 'color', defaultValue: '#ffffff' },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div data-cro-exit-intent style="display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);align-items:center;justify-content:center;">
        <div style="background:${p.bgColor};border-radius:12px;padding:40px;max-width:480px;width:90%;text-align:center;position:relative;">
          <button onclick="this.closest('[data-cro-exit-intent]').style.display='none'" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
          <h2 style="font-size:24px;font-weight:700;margin:0 0 8px;">${p.headline}</h2>
          <p style="font-size:16px;margin:0 0 20px;color:#6b7280;">${p.offer}</p>
          <button style="background:#2563eb;color:#fff;border:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600;cursor:pointer;">${p.btnText}</button>
        </div>
      </div>
      <script>
        (function(){var d=document.querySelector('[data-cro-exit-intent]');document.addEventListener('mouseout',function(e){if(!e.relatedTarget&&!e.toElement&&!d.__shown){d.style.display='flex';d.__shown=true;}});})();
      </script>`,
  },

  // ---- Trust ----
  {
    id: 'trust-badges',
    name: 'Trust Badge Row',
    description: 'A row of trust/security badges (SSL, money-back, free returns) to increase buyer confidence.',
    category: 'trust',
    expectedLift: '+2-5%',
    thumbnail: '',
    configurableProps: [
      { name: 'badge1', label: 'Badge 1 Text', type: 'text', defaultValue: '30-Day Money Back' },
      { name: 'badge2', label: 'Badge 2 Text', type: 'text', defaultValue: 'Free Returns' },
      { name: 'badge3', label: 'Badge 3 Text', type: 'text', defaultValue: 'Secure Checkout' },
      { name: 'iconColor', label: 'Icon Color', type: 'color', defaultValue: '#16a34a' },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div style="display:flex;gap:24px;justify-content:center;padding:16px;flex-wrap:wrap;">
        ${[p.badge1, p.badge2, p.badge3].map(b => `
          <div style="display:flex;align-items:center;gap:8px;font-size:14px;color:#374151;">
            <svg width="20" height="20" fill="none" stroke="${p.iconColor}" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>${b}</span>
          </div>`).join('')}
      </div>`,
  },

  // ---- Urgency ----
  {
    id: 'countdown-timer',
    name: 'Urgency Countdown Timer',
    description: 'A countdown timer that creates urgency for a limited-time offer.',
    category: 'urgency',
    expectedLift: '+3-8%',
    thumbnail: '',
    configurableProps: [
      { name: 'headline', label: 'Headline', type: 'text', defaultValue: 'Sale ends in:' },
      { name: 'hours', label: 'Hours', type: 'number', defaultValue: 2 },
      { name: 'minutes', label: 'Minutes', type: 'number', defaultValue: 30 },
      { name: 'bgColor', label: 'Background', type: 'color', defaultValue: '#fef2f2' },
      { name: 'textColor', label: 'Text Color', type: 'color', defaultValue: '#991b1b' },
    ],
    defaultCSS: '',
    buildHTML: (p) => {
      const uid = `ct_${Date.now()}`;
      return `
      <div style="background:${p.bgColor};padding:12px 24px;text-align:center;font-size:16px;color:${p.textColor};font-weight:600;">
        <span>${p.headline} </span>
        <span id="${uid}"></span>
      </div>
      <script>
        (function(){var end=Date.now()+${Number(p.hours)}*3600000+${Number(p.minutes)}*60000;function u(){var r=Math.max(0,end-Date.now()),h=Math.floor(r/3600000),m=Math.floor((r%3600000)/60000),s=Math.floor((r%60000)/1000);var el=document.getElementById("${uid}");if(el)el.textContent=h+"h "+m+"m "+s+"s";if(r>0)requestAnimationFrame(u);}u();})();
      </script>`;
    },
  },
  {
    id: 'free-shipping-bar',
    name: 'Free Shipping Bar',
    description: 'A top-of-page bar showing how close the customer is to free shipping.',
    category: 'urgency',
    expectedLift: '+2-6%',
    thumbnail: '',
    configurableProps: [
      { name: 'threshold', label: 'Free Shipping Threshold ($)', type: 'number', defaultValue: 50 },
      { name: 'message', label: 'Message', type: 'text', defaultValue: 'Free shipping on orders over $50!' },
      { name: 'bgColor', label: 'Background', type: 'color', defaultValue: '#ecfdf5' },
      { name: 'textColor', label: 'Text Color', type: 'color', defaultValue: '#065f46' },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div style="background:${p.bgColor};color:${p.textColor};text-align:center;padding:10px 16px;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px;">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        ${p.message}
      </div>`,
  },

  // ---- Social Proof ----
  {
    id: 'social-proof-popup',
    name: 'Social Proof Popup',
    description: 'A small toast notification showing recent purchases by other customers.',
    category: 'social-proof',
    expectedLift: '+3-7%',
    thumbnail: '',
    configurableProps: [
      { name: 'name', label: 'Customer Name', type: 'text', defaultValue: 'Sarah from New York' },
      { name: 'product', label: 'Product', type: 'text', defaultValue: 'Premium Bundle' },
      { name: 'timeAgo', label: 'Time Ago', type: 'text', defaultValue: '2 minutes ago' },
      { name: 'position', label: 'Position', type: 'select', defaultValue: 'bottom-left', options: ['bottom-left', 'bottom-right'] },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div data-cro-social-proof style="position:fixed;${p.position === 'bottom-left' ? 'left:20px' : 'right:20px'};bottom:20px;z-index:9998;background:#fff;border-radius:8px;padding:14px 18px;box-shadow:0 4px 20px rgba(0,0,0,.12);max-width:320px;display:flex;align-items:center;gap:12px;animation:slideUp .4s ease;">
        <div style="width:40px;height:40px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:18px;">🛒</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:#111827;">${p.name}</div>
          <div style="font-size:12px;color:#6b7280;">purchased <strong>${p.product}</strong></div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${p.timeAgo}</div>
        </div>
      </div>
      <style>@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}</style>`,
  },
  {
    id: 'testimonial-carousel',
    name: 'Testimonial Carousel',
    description: 'A rotating carousel of customer testimonials with star ratings.',
    category: 'social-proof',
    expectedLift: '+2-5%',
    thumbnail: '',
    configurableProps: [
      { name: 'heading', label: 'Heading', type: 'text', defaultValue: 'What Our Customers Say' },
      { name: 'bgColor', label: 'Background', type: 'color', defaultValue: '#f9fafb' },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div style="background:${p.bgColor};padding:40px 24px;text-align:center;">
        <h3 style="font-size:22px;font-weight:700;margin:0 0 24px;">${p.heading}</h3>
        <div style="max-width:600px;margin:0 auto;padding:24px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <div style="color:#f59e0b;font-size:20px;margin-bottom:12px;">★★★★★</div>
          <p style="font-size:15px;color:#374151;margin:0 0 12px;font-style:italic;">"This product exceeded my expectations. The quality is outstanding and shipping was fast!"</p>
          <p style="font-size:13px;color:#9ca3af;margin:0;">— Happy Customer</p>
        </div>
      </div>`,
  },

  // ---- Content ----
  {
    id: 'faq-accordion',
    name: 'FAQ Accordion',
    description: 'An expandable FAQ section to address common objections and reduce bounce.',
    category: 'content',
    expectedLift: '+1-4%',
    thumbnail: '',
    configurableProps: [
      { name: 'heading', label: 'Section Heading', type: 'text', defaultValue: 'Frequently Asked Questions' },
      { name: 'q1', label: 'Question 1', type: 'text', defaultValue: 'What is your return policy?' },
      { name: 'a1', label: 'Answer 1', type: 'text', defaultValue: 'We offer a 30-day money-back guarantee on all orders.' },
      { name: 'q2', label: 'Question 2', type: 'text', defaultValue: 'How long does shipping take?' },
      { name: 'a2', label: 'Answer 2', type: 'text', defaultValue: 'Orders ship within 1-2 business days. Delivery takes 3-5 business days.' },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div style="max-width:720px;margin:32px auto;padding:0 24px;">
        <h3 style="font-size:22px;font-weight:700;margin:0 0 16px;">${p.heading}</h3>
        ${[{ q: p.q1 as string, a: p.a1 as string }, { q: p.q2 as string, a: p.a2 as string }].map((item, i) => `
          <details style="border-bottom:1px solid #e5e7eb;padding:14px 0;" ${i === 0 ? 'open' : ''}>
            <summary style="font-size:15px;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">${item.q}<span>+</span></summary>
            <p style="font-size:14px;color:#6b7280;margin:10px 0 0;">${item.a}</p>
          </details>`).join('')}
      </div>`,
  },
  {
    id: 'comparison-table',
    name: 'Comparison Table',
    description: 'A side-by-side comparison table highlighting your product vs competitors.',
    category: 'content',
    expectedLift: '+3-7%',
    thumbnail: '',
    configurableProps: [
      { name: 'heading', label: 'Heading', type: 'text', defaultValue: 'Why Choose Us?' },
      { name: 'ourBrand', label: 'Our Brand Name', type: 'text', defaultValue: 'Our Product' },
      { name: 'competitor', label: 'Competitor Name', type: 'text', defaultValue: 'Others' },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div style="max-width:640px;margin:32px auto;padding:0 24px;">
        <h3 style="font-size:22px;font-weight:700;margin:0 0 16px;text-align:center;">${p.heading}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="border-bottom:2px solid #e5e7eb;">
            <th style="text-align:left;padding:10px;">Feature</th>
            <th style="text-align:center;padding:10px;color:#2563eb;">${p.ourBrand}</th>
            <th style="text-align:center;padding:10px;color:#9ca3af;">${p.competitor}</th>
          </tr></thead>
          <tbody>
            ${['Free Shipping','Money-Back Guarantee','Premium Quality','24/7 Support'].map(f => `
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:10px;">${f}</td>
                <td style="text-align:center;padding:10px;color:#16a34a;">&#10003;</td>
                <td style="text-align:center;padding:10px;color:#dc2626;">&#10007;</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`,
  },

  // ---- Navigation ----
  {
    id: 'announcement-banner',
    name: 'Announcement Banner',
    description: 'A dismissible top-of-page banner for sales, announcements, or promos.',
    category: 'navigation',
    expectedLift: '+1-3%',
    thumbnail: '',
    configurableProps: [
      { name: 'text', label: 'Banner Text', type: 'text', defaultValue: 'Summer Sale: 20% off everything with code SUMMER20' },
      { name: 'bgColor', label: 'Background', type: 'color', defaultValue: '#1e40af' },
      { name: 'textColor', label: 'Text Color', type: 'color', defaultValue: '#ffffff' },
      { name: 'dismissible', label: 'Dismissible', type: 'boolean', defaultValue: true },
    ],
    defaultCSS: '',
    buildHTML: (p) => `
      <div data-cro-banner style="background:${p.bgColor};color:${p.textColor};text-align:center;padding:10px 40px 10px 16px;font-size:14px;font-weight:500;position:relative;">
        ${p.text}
        ${p.dismissible ? `<button onclick="this.parentElement.remove()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:${p.textColor};font-size:18px;cursor:pointer;line-height:1;">&times;</button>` : ''}
      </div>`,
  },
];

// ============================================================
// Category metadata
// ============================================================

const CATEGORY_META: Record<ComponentCategory, { label: string; icon: React.ReactNode }> = {
  conversion: { label: 'Conversion', icon: <ShoppingCart size={16} /> },
  trust: { label: 'Trust', icon: <Shield size={16} /> },
  urgency: { label: 'Urgency', icon: <Clock size={16} /> },
  navigation: { label: 'Navigation', icon: <Megaphone size={16} /> },
  content: { label: 'Content', icon: <HelpCircle size={16} /> },
  'social-proof': { label: 'Social Proof', icon: <Star size={16} /> },
};

// ============================================================
// Component Library Panel
// ============================================================

interface ComponentLibraryProps {
  onInsert: (template: ComponentTemplate, resolvedProps: Record<string, string | number | boolean>) => void;
}

export default function ComponentLibrary({ onInsert }: ComponentLibraryProps) {
  const [expandedCategory, setExpandedCategory] = useState<ComponentCategory | null>('conversion');
  const [configuringTemplate, setConfiguringTemplate] = useState<ComponentTemplate | null>(null);
  const [propValues, setPropValues] = useState<Record<string, string | number | boolean>>({});

  const categories = Object.keys(CATEGORY_META) as ComponentCategory[];

  function openConfigurator(tpl: ComponentTemplate) {
    const defaults: Record<string, string | number | boolean> = {};
    tpl.configurableProps.forEach((p) => {
      defaults[p.name] = p.defaultValue;
    });
    setPropValues(defaults);
    setConfiguringTemplate(tpl);
  }

  function handleInsert() {
    if (!configuringTemplate) return;
    onInsert(configuringTemplate, propValues);
    setConfiguringTemplate(null);
  }

  // ---- Configurator overlay ----
  if (configuringTemplate) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{configuringTemplate.name}</h3>
          <button onClick={() => setConfiguringTemplate(null)} className="p-1 hover:bg-gray-100 rounded">
            <XIcon size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {configuringTemplate.configurableProps.map((prop) => (
            <PropField
              key={prop.name}
              prop={prop}
              value={propValues[prop.name]}
              onChange={(v) => setPropValues((prev) => ({ ...prev, [prop.name]: v }))}
            />
          ))}
        </div>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleInsert}
            className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Insert Component
          </button>
        </div>
      </div>
    );
  }

  // ---- Category list ----
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Component Library</h3>
        <p className="text-xs text-gray-500 mt-0.5">Drag or click to add CRO components</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat];
          const items = CRO_COMPONENTS.filter((c) => c.category === cat);
          const isOpen = expandedCategory === cat;

          return (
            <div key={cat}>
              <button
                onClick={() => setExpandedCategory(isOpen ? null : cat)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border-b border-gray-100"
              >
                {meta.icon}
                <span className="flex-1 text-left">{meta.label}</span>
                <span className="text-xs text-gray-400">{items.length}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {isOpen && (
                <div className="bg-gray-50/50">
                  {items.map((tpl) => (
                    <div
                      key={tpl.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/cro-component', tpl.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => openConfigurator(tpl)}
                      className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50 border-b border-gray-100 group"
                    >
                      <GripVertical size={14} className="mt-0.5 text-gray-300 group-hover:text-gray-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">{tpl.name}</span>
                          <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {tpl.expectedLift}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</p>
                      </div>
                      <ArrowUpRight size={14} className="mt-0.5 text-gray-300 group-hover:text-blue-500 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Single prop field renderer
// ============================================================

function PropField({
  prop,
  value,
  onChange,
}: {
  prop: ComponentProp;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  const id = `prop-${prop.name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">
        {prop.label}
      </label>
      {prop.type === 'text' || prop.type === 'url' ? (
        <input
          id={id}
          type="text"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      ) : prop.type === 'color' ? (
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
          />
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      ) : prop.type === 'number' ? (
        <input
          id={id}
          type="number"
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      ) : prop.type === 'boolean' ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">{value ? 'Enabled' : 'Disabled'}</span>
        </label>
      ) : prop.type === 'select' ? (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {prop.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
