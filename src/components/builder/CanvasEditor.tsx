'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { DOMChange, SectionBlock, DevicePreview, ElementSelection } from './types';
import { DEVICE_WIDTHS } from './types';
import ElementEditor from './ElementEditor';
import ComponentLibrary from './ComponentLibrary';
import { CRO_COMPONENTS } from './ComponentLibrary';
import type { ComponentTemplate } from './types';
import { v4 as uuid } from 'uuid';
import {
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Layers,
} from 'lucide-react';

// ============================================================
// CanvasEditor — standalone drag-and-drop canvas
// ============================================================

const ITEM_TYPE = 'SECTION_BLOCK';

interface CanvasEditorProps {
  targetUrl: string;
  device: DevicePreview;
  changes: DOMChange[];
  onAddChange: (change: DOMChange) => void;
}

// ---- Section detection heuristic ----

function parseSectionsFromHTML(html: string): SectionBlock[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const sectionTags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
  const sections: SectionBlock[] = [];
  let order = 0;

  // First pass: grab semantic elements
  const topLevel = Array.from(body.children);
  for (const child of topLevel) {
    const tag = child.tagName.toLowerCase();
    const id = child.id ? `#${child.id}` : '';
    const cls = child.className && typeof child.className === 'string'
      ? '.' + child.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';

    let label = tag.charAt(0).toUpperCase() + tag.slice(1);
    if (sectionTags.includes(tag)) {
      label = tag === 'nav' ? 'Navigation' : label;
    } else if (tag === 'div') {
      // Try to guess based on class or role
      const role = child.getAttribute('role');
      if (role) label = role.charAt(0).toUpperCase() + role.slice(1);
      else if (cls) label = `Section ${cls}`;
      else label = `Section ${order + 1}`;
    }

    sections.push({
      id: uuid(),
      label,
      selector: `body > ${tag}${id}${cls}:nth-child(${order + 1})`,
      html: child.outerHTML,
      order: order++,
    });
  }

  // If no top-level children detected, create one section for the whole body
  if (sections.length === 0) {
    sections.push({
      id: uuid(),
      label: 'Page Content',
      selector: 'body',
      html: body.innerHTML,
      order: 0,
    });
  }

  return sections;
}

export default function CanvasEditor({ targetUrl, device, changes, onAddChange }: CanvasEditorProps) {
  const [sections, setSections] = useState<SectionBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementSelection | null>(null);
  const [showComponents, setShowComponents] = useState(true);
  const containerWidth = DEVICE_WIDTHS[device];

  // Fetch and parse the HTML
  useEffect(() => {
    async function fetchHTML() {
      setLoading(true);
      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}&raw=1`);
        const html = await res.text();
        const parsed = parseSectionsFromHTML(html);
        setSections(parsed);
      } catch (err) {
        console.error('Failed to fetch page for canvas:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHTML();
  }, [targetUrl]);

  // Move a section to a new position
  const moveSection = useCallback((dragIndex: number, hoverIndex: number) => {
    setSections((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(hoverIndex, 0, removed);
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  // Insert a component from the library
  function handleInsertComponent(
    template: ComponentTemplate,
    resolvedProps: Record<string, string | number | boolean>,
  ) {
    const html = template.buildHTML(resolvedProps);
    const newSection: SectionBlock = {
      id: uuid(),
      label: template.name,
      selector: `[data-cro-component="${template.id}-${Date.now()}"]`,
      html: `<div data-cro-component="${template.id}-${Date.now()}">${html}</div>`,
      order: sections.length,
      isCustomComponent: true,
      templateId: template.id,
    };

    setSections((prev) => [...prev, newSection]);

    const change: DOMChange = {
      id: uuid(),
      selector: 'body',
      action: 'insert',
      html: newSection.html,
      position: { placement: 'append' },
      timestamp: new Date().toISOString(),
    };
    onAddChange(change);
  }

  // Delete a section
  function handleDeleteSection(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    setSections((prev) => prev.filter((s) => s.id !== sectionId));

    const change: DOMChange = {
      id: uuid(),
      selector: section.selector,
      action: 'delete',
      oldValue: section.html,
      timestamp: new Date().toISOString(),
    };
    onAddChange(change);
  }

  // Handle element-level change from the editor panel
  function handleApplyChange(change: DOMChange) {
    onAddChange(change);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Parsing page structure...</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar: sections list + component library toggle */}
        <div className="w-72 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          {/* Toggle between sections list and component library */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setShowComponents(false)}
              className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
                !showComponents ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layers size={14} className="inline mr-1" />
              Sections
            </button>
            <button
              onClick={() => setShowComponents(true)}
              className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
                showComponents ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus size={14} className="inline mr-1" />
              Components
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {showComponents ? (
              <ComponentLibrary onInsert={handleInsertComponent} />
            ) : (
              <div className="p-2 space-y-1">
                {sections.map((section, index) => (
                  <div
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                      selectedSection === section.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <GripVertical size={14} className="text-gray-400 shrink-0" />
                    <span className="flex-1 truncate">{section.label}</span>
                    {section.isCustomComponent && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">CRO</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(section.id);
                      }}
                      className="p-0.5 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: canvas */}
        <div className="flex-1 bg-gray-100 overflow-auto p-6 flex justify-center">
          <div
            className="bg-white shadow-lg rounded-lg overflow-hidden"
            style={{ width: containerWidth, maxWidth: '100%' }}
          >
            {sections.map((section, index) => (
              <DraggableSection
                key={section.id}
                section={section}
                index={index}
                moveSection={moveSection}
                isSelected={selectedSection === section.id}
                onSelect={() => setSelectedSection(section.id)}
                onDelete={() => handleDeleteSection(section.id)}
              />
            ))}

            {sections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Layers size={40} className="mb-3" />
                <p className="text-sm font-medium">No sections detected</p>
                <p className="text-xs mt-1">Add components from the library</p>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: element editor (if a section is selected) */}
        {selectedSection && selectedElement && (
          <ElementEditor
            selection={selectedElement}
            onApplyChange={handleApplyChange}
            onClose={() => setSelectedElement(null)}
          />
        )}

        {selectedSection && !selectedElement && (
          <div className="w-72 border-l border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Section Properties</h3>
            {(() => {
              const sec = sections.find((s) => s.id === selectedSection);
              if (!sec) return null;
              return (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                    <input
                      type="text"
                      value={sec.label}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s) => (s.id === sec.id ? { ...s, label: e.target.value } : s)),
                        )
                      }
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Selector</label>
                    <p className="text-xs font-mono text-gray-500 break-all bg-gray-50 rounded p-2">
                      {sec.selector}
                    </p>
                  </div>
                  {sec.isCustomComponent && (
                    <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      Custom CRO Component
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </DndProvider>
  );
}

// ============================================================
// Draggable Section Block
// ============================================================

interface DraggableSectionProps {
  section: SectionBlock;
  index: number;
  moveSection: (dragIndex: number, hoverIndex: number) => void;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function DraggableSection({
  section,
  index,
  moveSection,
  isSelected,
  onSelect,
  onDelete,
}: DraggableSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: ITEM_TYPE,
    item: () => ({ index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: ITEM_TYPE,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveSection(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`relative group transition-all ${
        isDragging ? 'opacity-30' : 'opacity-100'
      } ${isOver ? 'border-t-2 border-blue-500' : ''} ${
        isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
      }`}
    >
      {/* Section label overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1 bg-gray-900/70 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <GripVertical size={12} className="cursor-grab" />
          <span>{section.label}</span>
          {section.isCustomComponent && (
            <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">CRO</span>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="hover:text-red-400">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Rendered section HTML */}
      <div
        className="pointer-events-none"
        dangerouslySetInnerHTML={{ __html: section.html }}
      />
    </div>
  );
}
