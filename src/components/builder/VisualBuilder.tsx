'use client';

import React, { useState, useCallback } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Save,
  Eye,
  MousePointerClick,
  LayoutDashboard,
} from 'lucide-react';
import type {
  DOMChange,
  EditorMode,
  DevicePreview,
  BuilderState,
  VisualBuilderProps,
} from './types';
import LiveEditor from './LiveEditor';
import CanvasEditor from './CanvasEditor';

// ============================================================
// VisualBuilder — top-level wrapper that switches between
// LiveEditor (iframe proxy) and CanvasEditor (drag-and-drop).
// ============================================================

export default function VisualBuilder({
  testId,
  targetUrl,
  existingVariant,
}: VisualBuilderProps) {
  const [state, setState] = useState<BuilderState>({
    mode: 'live',
    device: 'desktop',
    changes: existingVariant?.changes || [],
    undoStack: [],
    redoStack: [],
    selectedElement: null,
    isSaving: false,
    isDirty: false,
  });

  // ---- Mutation helpers ----

  const addChange = useCallback((change: DOMChange) => {
    setState((prev) => ({
      ...prev,
      changes: [...prev.changes, change],
      undoStack: [...prev.undoStack, prev.changes],
      redoStack: [],
      isDirty: true,
    }));
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.undoStack.length === 0) return prev;
      const undoStack = [...prev.undoStack];
      const previousChanges = undoStack.pop()!;
      return {
        ...prev,
        changes: previousChanges,
        undoStack,
        redoStack: [...prev.redoStack, prev.changes],
        isDirty: true,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.redoStack.length === 0) return prev;
      const redoStack = [...prev.redoStack];
      const nextChanges = redoStack.pop()!;
      return {
        ...prev,
        changes: nextChanges,
        undoStack: [...prev.undoStack, prev.changes],
        redoStack,
        isDirty: true,
      };
    });
  }, []);

  // ---- Save ----

  async function handleSave() {
    setState((prev) => ({ ...prev, isSaving: true }));
    try {
      await fetch('/api/variants', {
        method: existingVariant ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          variantId: existingVariant?.id,
          changes: state.changes,
        }),
      });
      setState((prev) => ({ ...prev, isDirty: false }));
    } catch (err) {
      console.error('Failed to save variant:', err);
    } finally {
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  }

  // ---- Preview ----

  function handlePreview() {
    // Opens a new tab with the proxy page + changes applied via query param
    const changesParam = encodeURIComponent(JSON.stringify(state.changes));
    window.open(
      `/api/proxy?url=${encodeURIComponent(targetUrl)}&changes=${changesParam}`,
      '_blank',
    );
  }

  // ---- Device button helper ----

  const devices: { id: DevicePreview; icon: React.ReactNode; label: string }[] = [
    { id: 'mobile', icon: <Smartphone size={16} />, label: 'Mobile' },
    { id: 'tablet', icon: <Tablet size={16} />, label: 'Tablet' },
    { id: 'desktop', icon: <Monitor size={16} />, label: 'Desktop' },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ---- Toolbar ---- */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 z-20">
        {/* Mode toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setState((p) => ({ ...p, mode: 'live' }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              state.mode === 'live'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MousePointerClick size={14} />
            Live Edit
          </button>
          <button
            onClick={() => setState((p) => ({ ...p, mode: 'canvas' }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              state.mode === 'canvas'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutDashboard size={14} />
            Canvas
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-200" />

        {/* Device preview buttons */}
        <div className="flex items-center gap-1">
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => setState((p) => ({ ...p, device: d.id }))}
              title={d.label}
              className={`p-1.5 rounded-md transition-colors ${
                state.device === d.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              {d.icon}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-200" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={state.undoStack.length === 0}
            title="Undo"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={state.redoStack.length === 0}
            title="Redo"
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Changes badge */}
        {state.changes.length > 0 && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {state.changes.length} change{state.changes.length !== 1 && 's'}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Preview */}
        <button
          onClick={handlePreview}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Eye size={14} />
          Preview
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={state.isSaving || !state.isDirty}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} />
          {state.isSaving ? 'Saving...' : 'Save Variant'}
        </button>
      </header>

      {/* ---- Editor body ---- */}
      <div className="flex-1 flex min-h-0">
        {state.mode === 'live' ? (
          <LiveEditor
            targetUrl={targetUrl}
            device={state.device}
            changes={state.changes}
            onAddChange={addChange}
          />
        ) : (
          <CanvasEditor
            targetUrl={targetUrl}
            device={state.device}
            changes={state.changes}
            onAddChange={addChange}
          />
        )}
      </div>
    </div>
  );
}
