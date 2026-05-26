'use client';

import React, { useState, useCallback } from 'react';
import {
  Type,
  Paintbrush,
  LayoutGrid,
  Code,
  Sparkles,
  Image as ImageIcon,
  Link,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import type { ElementSelection, DOMChange } from './types';
import { v4 as uuid } from 'uuid';

// ============================================================
// Element Editor — sidebar property panel for both modes
// ============================================================

type Tab = 'content' | 'style' | 'layout' | 'advanced';

interface ElementEditorProps {
  selection: ElementSelection;
  onApplyChange: (change: DOMChange) => void;
  onClose: () => void;
}

export default function ElementEditor({ selection, onApplyChange, onClose }: ElementEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('content');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'content', label: 'Content', icon: <Type size={14} /> },
    { id: 'style', label: 'Style', icon: <Paintbrush size={14} /> },
    { id: 'layout', label: 'Layout', icon: <LayoutGrid size={14} /> },
    { id: 'advanced', label: 'Advanced', icon: <Code size={14} /> },
  ];

  // Helper: create a change record
  const emitChange = useCallback(
    (
      action: DOMChange['action'],
      property: string,
      oldValue: string,
      newValue: string,
    ) => {
      onApplyChange({
        id: uuid(),
        selector: selection.selector,
        action,
        property,
        oldValue,
        newValue,
        timestamp: new Date().toISOString(),
      });
    },
    [onApplyChange, selection.selector],
  );

  // AI suggestion handler
  async function handleAiSuggest() {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await fetch('/api/ai/suggest-element', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagName: selection.tagName,
          textContent: selection.textContent,
          styles: selection.styles,
          attributes: selection.attributes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestion(data.suggestion);
      }
    } catch {
      setAiSuggestion('Unable to generate suggestions at this time.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            &lt;{selection.tagName.toLowerCase()}&gt;
          </h3>
          {selection.textContent && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{selection.textContent.slice(0, 40)}</p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
              activeTab === t.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === 'content' && (
          <ContentTab selection={selection} emitChange={emitChange} />
        )}
        {activeTab === 'style' && (
          <StyleTab selection={selection} emitChange={emitChange} />
        )}
        {activeTab === 'layout' && (
          <LayoutTab selection={selection} emitChange={emitChange} />
        )}
        {activeTab === 'advanced' && (
          <AdvancedTab selection={selection} emitChange={emitChange} />
        )}
      </div>

      {/* AI Suggest Footer */}
      <div className="p-3 border-t border-gray-200 space-y-2">
        <button
          onClick={handleAiSuggest}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium py-2 rounded-md hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-60"
        >
          <Sparkles size={14} />
          {aiLoading ? 'Analyzing...' : 'AI Suggest Improvements'}
        </button>
        {aiSuggestion && (
          <div className="bg-purple-50 border border-purple-200 rounded-md p-2.5 text-xs text-purple-800">
            {aiSuggestion}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tab panels
// ============================================================

type EmitFn = (action: DOMChange['action'], property: string, oldValue: string, newValue: string) => void;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>;
}

// ---- Content Tab ----

function ContentTab({
  selection,
  emitChange,
}: {
  selection: ElementSelection;
  emitChange: EmitFn;
}) {
  const [text, setText] = useState(selection.textContent || '');
  const [imgSrc, setImgSrc] = useState(selection.attributes.src || '');
  const [linkHref, setLinkHref] = useState(selection.attributes.href || '');

  const isImage = selection.tagName === 'IMG';
  const isLink = selection.tagName === 'A';

  return (
    <>
      {/* Text content */}
      {!isImage && (
        <div>
          <FieldLabel>Text Content</FieldLabel>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (text !== (selection.textContent || '')) {
                emitChange('modify', 'textContent', selection.textContent || '', text);
              }
            }}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm resize-y focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      )}

      {/* Image swap */}
      {isImage && (
        <div>
          <FieldLabel>
            <span className="flex items-center gap-1"><ImageIcon size={12} /> Image Source</span>
          </FieldLabel>
          <input
            type="text"
            value={imgSrc}
            onChange={(e) => setImgSrc(e.target.value)}
            onBlur={() => {
              if (imgSrc !== (selection.attributes.src || '')) {
                emitChange('modify', 'src', selection.attributes.src || '', imgSrc);
              }
            }}
            placeholder="https://..."
            className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      )}

      {/* Link */}
      {isLink && (
        <div>
          <FieldLabel>
            <span className="flex items-center gap-1"><Link size={12} /> Link URL</span>
          </FieldLabel>
          <input
            type="text"
            value={linkHref}
            onChange={(e) => setLinkHref(e.target.value)}
            onBlur={() => {
              if (linkHref !== (selection.attributes.href || '')) {
                emitChange('modify', 'href', selection.attributes.href || '', linkHref);
              }
            }}
            placeholder="https://..."
            className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      )}

      {/* Visibility toggle */}
      <div>
        <FieldLabel>Visibility</FieldLabel>
        <div className="flex gap-2">
          <button
            onClick={() => emitChange('hide', 'style.display', '', 'none')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <EyeOff size={12} /> Hide Element
          </button>
          <button
            onClick={() => emitChange('show', 'style.display', 'none', '')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Eye size={12} /> Show Element
          </button>
        </div>
      </div>
    </>
  );
}

// ---- Style Tab ----

function StyleTab({
  selection,
  emitChange,
}: {
  selection: ElementSelection;
  emitChange: EmitFn;
}) {
  const s = selection.styles;

  return (
    <>
      <StyleField label="Font Size" property="style.fontSize" currentValue={s.fontSize || ''} emitChange={emitChange} type="text" placeholder="16px" />
      <StyleField label="Font Weight" property="style.fontWeight" currentValue={s.fontWeight || ''} emitChange={emitChange} type="select" options={['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']} />
      <StyleColorField label="Text Color" property="style.color" currentValue={s.color || '#000000'} emitChange={emitChange} />
      <StyleColorField label="Background Color" property="style.backgroundColor" currentValue={s.backgroundColor || '#ffffff'} emitChange={emitChange} />
      <StyleField label="Padding" property="style.padding" currentValue={s.padding || ''} emitChange={emitChange} type="text" placeholder="8px 16px" />
      <StyleField label="Margin" property="style.margin" currentValue={s.margin || ''} emitChange={emitChange} type="text" placeholder="0px" />
      <StyleField label="Border Radius" property="style.borderRadius" currentValue={s.borderRadius || ''} emitChange={emitChange} type="text" placeholder="4px" />
      <StyleField label="Border" property="style.border" currentValue={s.border || ''} emitChange={emitChange} type="text" placeholder="1px solid #ccc" />
      <StyleField label="Box Shadow" property="style.boxShadow" currentValue={s.boxShadow || ''} emitChange={emitChange} type="text" placeholder="0 2px 4px rgba(0,0,0,.1)" />
      <StyleField label="Opacity" property="style.opacity" currentValue={s.opacity || '1'} emitChange={emitChange} type="text" placeholder="1" />
    </>
  );
}

function StyleField({
  label,
  property,
  currentValue,
  emitChange,
  type,
  placeholder,
  options,
}: {
  label: string;
  property: string;
  currentValue: string;
  emitChange: EmitFn;
  type: 'text' | 'select';
  placeholder?: string;
  options?: string[];
}) {
  const [val, setVal] = useState(currentValue);

  const commit = () => {
    if (val !== currentValue) {
      emitChange('restyle', property, currentValue, val);
    }
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {type === 'text' ? (
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      ) : (
        <select
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            emitChange('restyle', property, currentValue, e.target.value);
          }}
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function StyleColorField({
  label,
  property,
  currentValue,
  emitChange,
}: {
  label: string;
  property: string;
  currentValue: string;
  emitChange: EmitFn;
}) {
  const [val, setVal] = useState(currentValue);

  const commit = (v: string) => {
    if (v !== currentValue) {
      emitChange('restyle', property, currentValue, v);
    }
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            commit(e.target.value);
          }}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
        />
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => commit(val)}
          className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>
    </div>
  );
}

// ---- Layout Tab ----

function LayoutTab({
  selection,
  emitChange,
}: {
  selection: ElementSelection;
  emitChange: EmitFn;
}) {
  const s = selection.styles;

  return (
    <>
      <StyleField label="Display" property="style.display" currentValue={s.display || 'block'} emitChange={emitChange} type="select" options={['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none']} />
      <StyleField label="Flex Direction" property="style.flexDirection" currentValue={s.flexDirection || 'row'} emitChange={emitChange} type="select" options={['row', 'row-reverse', 'column', 'column-reverse']} />
      <StyleField label="Justify Content" property="style.justifyContent" currentValue={s.justifyContent || 'flex-start'} emitChange={emitChange} type="select" options={['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']} />
      <StyleField label="Align Items" property="style.alignItems" currentValue={s.alignItems || 'stretch'} emitChange={emitChange} type="select" options={['stretch', 'flex-start', 'center', 'flex-end', 'baseline']} />
      <StyleField label="Gap" property="style.gap" currentValue={s.gap || ''} emitChange={emitChange} type="text" placeholder="8px" />
      <StyleField label="Width" property="style.width" currentValue={s.width || ''} emitChange={emitChange} type="text" placeholder="auto" />
      <StyleField label="Height" property="style.height" currentValue={s.height || ''} emitChange={emitChange} type="text" placeholder="auto" />
      <StyleField label="Max Width" property="style.maxWidth" currentValue={s.maxWidth || ''} emitChange={emitChange} type="text" placeholder="none" />
      <StyleField label="Position" property="style.position" currentValue={s.position || 'static'} emitChange={emitChange} type="select" options={['static', 'relative', 'absolute', 'fixed', 'sticky']} />
      <StyleField label="Z-Index" property="style.zIndex" currentValue={s.zIndex || ''} emitChange={emitChange} type="text" placeholder="auto" />
    </>
  );
}

// ---- Advanced Tab ----

function AdvancedTab({
  selection,
  emitChange,
}: {
  selection: ElementSelection;
  emitChange: EmitFn;
}) {
  const [customCSS, setCustomCSS] = useState('');
  const [animation, setAnimation] = useState('none');

  const animations = [
    { value: 'none', label: 'None' },
    { value: 'fadeIn', label: 'Fade In' },
    { value: 'slideUp', label: 'Slide Up' },
    { value: 'slideDown', label: 'Slide Down' },
    { value: 'slideLeft', label: 'Slide Left' },
    { value: 'slideRight', label: 'Slide Right' },
    { value: 'zoomIn', label: 'Zoom In' },
    { value: 'bounce', label: 'Bounce' },
  ];

  return (
    <>
      {/* Custom CSS */}
      <div>
        <FieldLabel>Custom CSS</FieldLabel>
        <textarea
          value={customCSS}
          onChange={(e) => setCustomCSS(e.target.value)}
          onBlur={() => {
            if (customCSS.trim()) {
              emitChange('restyle', 'style.cssText', '', customCSS);
            }
          }}
          rows={4}
          placeholder="color: red;&#10;font-size: 18px;"
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-mono resize-y focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Custom attributes */}
      <div>
        <FieldLabel>Custom Attribute</FieldLabel>
        <div className="flex gap-2">
          <input
            id="attr-name"
            placeholder="data-name"
            className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <input
            id="attr-value"
            placeholder="value"
            className="flex-1 border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={() => {
            const nameEl = document.getElementById('attr-name') as HTMLInputElement;
            const valEl = document.getElementById('attr-value') as HTMLInputElement;
            if (nameEl?.value) {
              emitChange('modify', nameEl.value, selection.attributes[nameEl.value] || '', valEl?.value || '');
              nameEl.value = '';
              if (valEl) valEl.value = '';
            }
          }}
          className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          + Set Attribute
        </button>
      </div>

      {/* Animation */}
      <div>
        <FieldLabel>Entrance Animation</FieldLabel>
        <select
          value={animation}
          onChange={(e) => {
            setAnimation(e.target.value);
            emitChange('restyle', 'data-animation', 'none', e.target.value);
          }}
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {animations.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {/* Element info */}
      <div className="bg-gray-50 rounded-md p-2.5 space-y-1">
        <p className="text-xs font-medium text-gray-600">Element Info</p>
        <p className="text-xs text-gray-500 font-mono break-all">Selector: {selection.selector}</p>
        <p className="text-xs text-gray-500">Tag: {selection.tagName}</p>
      </div>
    </>
  );
}
