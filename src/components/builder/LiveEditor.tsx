'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { DOMChange, DevicePreview, ElementSelection } from './types';
import { DEVICE_WIDTHS } from './types';
import ElementEditor from './ElementEditor';
import ComponentLibrary from './ComponentLibrary';
import { CRO_COMPONENTS } from './ComponentLibrary';
import type { ComponentTemplate } from './types';
import { v4 as uuid } from 'uuid';
import {
  MousePointerClick,
  Layers,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// ============================================================
// LiveEditor — loads the merchant's storefront in a proxied iframe
// and lets the user click-to-select elements and edit them.
// ============================================================

interface LiveEditorProps {
  targetUrl: string;
  device: DevicePreview;
  changes: DOMChange[];
  onAddChange: (change: DOMChange) => void;
}

/** The script injected into the proxied iframe. Handles hover highlight,
 *  click selection, and postMessage communication with the parent. */
function getInjectionScript(): string {
  return `
(function() {
  if (window.__cro_injected) return;
  window.__cro_injected = true;

  var hovered = null;
  var selected = null;
  var OUTLINE_HOVER = '2px solid #3b82f6';
  var OUTLINE_SELECTED = '2px solid #2563eb';
  var BG_SELECTED = 'rgba(37,99,235,0.06)';

  // Generate a unique CSS selector for an element
  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1) {
      var part = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
      if (el.className && typeof el.className === 'string') {
        var cls = el.className.trim().split(/\\s+/).filter(function(c){return c.length>0;}).slice(0,2);
        if (cls.length) part += '.' + cls.map(function(c){return CSS.escape(c);}).join('.');
      }
      var parent = el.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c){return c.tagName===el.tagName;});
        if (siblings.length > 1) {
          var idx = siblings.indexOf(el) + 1;
          part += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(part);
      el = parent;
    }
    return parts.join(' > ');
  }

  function getComputedStyles(el) {
    var cs = window.getComputedStyle(el);
    var keys = ['fontSize','fontWeight','color','backgroundColor','padding','margin',
      'borderRadius','border','boxShadow','opacity','display','flexDirection',
      'justifyContent','alignItems','gap','width','height','maxWidth','position','zIndex'];
    var obj = {};
    keys.forEach(function(k){ obj[k] = cs[k] || ''; });
    return obj;
  }

  function getAttributes(el) {
    var obj = {};
    Array.from(el.attributes).forEach(function(a){ obj[a.name] = a.value; });
    return obj;
  }

  // Hover
  document.addEventListener('mouseover', function(e) {
    if (e.target === document.body || e.target === document.documentElement) return;
    if (hovered && hovered !== selected) hovered.style.outline = '';
    hovered = e.target;
    if (hovered !== selected) hovered.style.outline = OUTLINE_HOVER;
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (hovered && hovered !== selected) hovered.style.outline = '';
  }, true);

  // Click -> select
  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (selected) { selected.style.outline = ''; selected.style.backgroundColor = ''; }
    selected = e.target;
    selected.style.outline = OUTLINE_SELECTED;

    var data = {
      type: 'element-selected',
      selector: getSelector(selected),
      tagName: selected.tagName,
      textContent: (selected.textContent || '').trim().substring(0, 200),
      styles: getComputedStyles(selected),
      attributes: getAttributes(selected),
      outerHTML: selected.outerHTML.substring(0, 2000),
    };
    window.parent.postMessage(data, '*');
  }, true);

  // Listen for apply-change from parent
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'apply-change') return;
    var c = e.data.change;
    var el = document.querySelector(c.selector);
    if (!el) return;

    switch (c.action) {
      case 'modify':
        if (c.property === 'textContent') el.textContent = c.newValue;
        else if (c.property === 'src') el.src = c.newValue;
        else if (c.property === 'href') el.href = c.newValue;
        else el.setAttribute(c.property, c.newValue);
        break;
      case 'restyle':
        if (c.property === 'style.cssText') {
          el.style.cssText += c.newValue;
        } else if (c.property && c.property.startsWith('style.')) {
          el.style[c.property.replace('style.', '')] = c.newValue;
        }
        break;
      case 'hide':
        el.style.display = 'none';
        break;
      case 'show':
        el.style.display = '';
        break;
      case 'delete':
        el.remove();
        break;
      case 'insert':
        if (c.position && c.position.placement === 'before') el.insertAdjacentHTML('beforebegin', c.html || '');
        else if (c.position && c.position.placement === 'after') el.insertAdjacentHTML('afterend', c.html || '');
        else if (c.position && c.position.placement === 'prepend') el.insertAdjacentHTML('afterbegin', c.html || '');
        else el.insertAdjacentHTML('beforeend', c.html || '');
        break;
      case 'move':
        if (c.position && c.position.parentSelector) {
          var np = document.querySelector(c.position.parentSelector);
          if (np) {
            var idx = c.position.index || 0;
            if (idx >= np.children.length) np.appendChild(el);
            else np.insertBefore(el, np.children[idx]);
          }
        }
        break;
    }
  });
})();
`;
}

export default function LiveEditor({ targetUrl, device, changes, onAddChange }: LiveEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selection, setSelection] = useState<ElementSelection | null>(null);
  const [showComponents, setShowComponents] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  const containerWidth = DEVICE_WIDTHS[device];

  // Listen for postMessage from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'element-selected') {
        setSelection({
          selector: e.data.selector,
          tagName: e.data.tagName,
          textContent: e.data.textContent,
          styles: e.data.styles || {},
          attributes: e.data.attributes || {},
          outerHTML: e.data.outerHTML || '',
        });
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Push changes to iframe
  const pushChange = useCallback(
    (change: DOMChange) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'apply-change', change },
        '*',
      );
    },
    [],
  );

  // Replay all existing changes when iframe loads
  useEffect(() => {
    if (iframeLoaded && changes.length > 0) {
      changes.forEach((c) => pushChange(c));
    }
  }, [iframeLoaded, changes, pushChange]);

  function handleApplyChange(change: DOMChange) {
    pushChange(change);
    onAddChange(change);
  }

  function handleDeleteElement() {
    if (!selection) return;
    const change: DOMChange = {
      id: uuid(),
      selector: selection.selector,
      action: 'delete',
      oldValue: selection.outerHTML,
      timestamp: new Date().toISOString(),
    };
    handleApplyChange(change);
    setSelection(null);
  }

  function handleMoveElement(direction: 'up' | 'down') {
    if (!selection) return;
    const change: DOMChange = {
      id: uuid(),
      selector: selection.selector,
      action: 'move',
      position: {
        parentSelector: selection.selector.replace(/ > [^>]+$/, '') || 'body',
        index: direction === 'up' ? -1 : 1, // relative movement
      },
      timestamp: new Date().toISOString(),
    };
    handleApplyChange(change);
  }

  function handleInsertComponent(
    template: ComponentTemplate,
    resolvedProps: Record<string, string | number | boolean>,
  ) {
    const html = template.buildHTML(resolvedProps);
    const targetSelector = selection?.selector || 'body';
    const change: DOMChange = {
      id: uuid(),
      selector: targetSelector,
      action: 'insert',
      html,
      position: { placement: selection ? 'after' : 'append' },
      timestamp: new Date().toISOString(),
    };
    handleApplyChange(change);
    setShowComponents(false);
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Component library sidebar (togglable) */}
      {showComponents && (
        <div className="w-72 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <ComponentLibrary onInsert={handleInsertComponent} />
        </div>
      )}

      {/* Center: iframe container */}
      <div className="flex-1 flex flex-col items-center bg-gray-100 overflow-auto p-4">
        {/* Quick action bar */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowComponents(!showComponents)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              showComponents
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Plus size={14} /> Components
          </button>
          {selection && (
            <>
              <button
                onClick={() => handleMoveElement('up')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <ArrowUp size={14} /> Move Up
              </button>
              <button
                onClick={() => handleMoveElement('down')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <ArrowDown size={14} /> Move Down
              </button>
              <button
                onClick={handleDeleteElement}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>

        {/* Iframe wrapper */}
        <div
          className="bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300"
          style={{ width: containerWidth, maxWidth: '100%' }}
        >
          <iframe
            ref={iframeRef}
            src={proxyUrl}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 140px)' }}
            onLoad={() => setIframeLoaded(true)}
            sandbox="allow-scripts allow-same-origin allow-forms"
            title="Live site preview"
          />
        </div>

        {!iframeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Loading storefront...</p>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar: element editor */}
      {selection && (
        <ElementEditor
          selection={selection}
          onApplyChange={handleApplyChange}
          onClose={() => setSelection(null)}
        />
      )}

      {/* Empty state when nothing selected */}
      {!selection && !showComponents && (
        <div className="w-64 border-l border-gray-200 bg-white flex flex-col items-center justify-center p-6 text-center">
          <MousePointerClick size={32} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Click an element</p>
          <p className="text-xs text-gray-400 mt-1">
            Hover over elements in the preview to highlight them, then click to select and edit.
          </p>
        </div>
      )}
    </div>
  );
}
