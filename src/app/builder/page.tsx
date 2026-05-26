'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import VisualBuilder from '@/components/builder/VisualBuilder';

// ============================================================
// /builder page — full-screen visual editor
// Reads ?testId= and ?url= from the URL.
// ============================================================

function BuilderInner() {
  const searchParams = useSearchParams();
  const testId = searchParams.get('testId') || '';
  const url = searchParams.get('url') || '';

  if (!url) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">No URL Provided</h1>
          <p className="text-sm text-gray-600 mb-4">
            The visual builder needs a target URL to load. Pass it as a query parameter:
          </p>
          <code className="text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-md block">
            /builder?url=https://your-store.myshopify.com&testId=abc123
          </code>
        </div>
      </div>
    );
  }

  return <VisualBuilder testId={testId} targetUrl={url} />;
}

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BuilderInner />
    </Suspense>
  );
}
