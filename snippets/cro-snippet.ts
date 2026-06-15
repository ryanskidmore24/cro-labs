/**
 * CRO Platform — Client-side Snippet
 *
 * Lightweight script for Shopify Liquid themes. Handles:
 *   1. Visitor/session identification via first-party cookies
 *   2. Fetching active tests from the platform API
 *   3. Deterministic variant assignment (hash-based)
 *   4. DOM manipulation to apply variant changes
 *   5. Automatic event tracking (impressions, clicks, scrolls, conversions)
 *
 * Install via a single script tag:
 *   <script src="https://your-domain.com/snippet.js" data-key="pk_xxxxxxxxxxxx" async></script>
 *
 * No external dependencies. Target: < 15KB minified+gzipped.
 */

// ---------------------------------------------------------------------------
// Types (stripped at compile time)
// ---------------------------------------------------------------------------

interface CROConfig {
  apiUrl: string;
  orgKey: string;
}

interface DOMChange {
  action: 'modify_text' | 'restyle' | 'hide' | 'show' | 'move' | 'insert' | 'delete' | 'replace_html' | 'add_class' | 'remove_class';
  selector: string;
  value?: string;
  styles?: Record<string, string>;
  position?: 'before' | 'after' | 'prepend' | 'append';
  targetSelector?: string;
  html?: string;
}

interface Variant {
  id: string;
  name: string;
  isControl: boolean;
  weight: number;
  domChanges: DOMChange[];
  cssChanges: string | null;
  jsChanges: string | null;
}

interface Test {
  id: string;
  name: string;
  trafficPercent: number;
  variants: Variant[];
}

interface CROTrackEvent {
  testId: string;
  variantId: string;
  visitorId: string;
  sessionId: string;
  eventType: 'IMPRESSION' | 'CLICK' | 'CONVERSION' | 'FORM_SUBMIT' | 'SCROLL' | 'CUSTOM';
  eventData?: Record<string, unknown> | null;
  revenue?: number | null;
  pageUrl?: string | null;
  device?: string | null;
  source?: string | null;
  timestamp?: number;
}

interface VariantAssignment {
  testId: string;
  variantId: string;
}

// ---------------------------------------------------------------------------
// IIFE — the entire snippet runs inside an immediately-invoked function
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  // Prevent double initialization
  if ((window as any).__CRO_INITIALIZED) return;
  (window as any).__CRO_INITIALIZED = true;

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  const config = readConfig();
  if (!config) return; // silently bail if misconfigured

  // -----------------------------------------------------------------------
  // Cookie helpers
  // -----------------------------------------------------------------------

  function setCookie(name: string, value: string, days?: number): void {
    let expires = '';
    if (days) {
      const d = new Date();
      d.setTime(d.getTime() + days * 86400000);
      expires = '; expires=' + d.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // -----------------------------------------------------------------------
  // ID generation
  // -----------------------------------------------------------------------

  function generateId(): string {
    // Compact unique ID: timestamp base36 + random chars
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 10);
    return ts + rand;
  }

  // -----------------------------------------------------------------------
  // Visitor & session IDs
  // -----------------------------------------------------------------------

  let visitorId = getCookie('_cro_vid');
  if (!visitorId) {
    visitorId = generateId();
    setCookie('_cro_vid', visitorId, 365);
  }

  let sessionId = getCookie('_cro_sid');
  if (!sessionId) {
    sessionId = generateId();
    // Session cookie — no explicit expiry, expires when browser closes
    setCookie('_cro_sid', sessionId);
  }

  // -----------------------------------------------------------------------
  // Device detection
  // -----------------------------------------------------------------------

  function detectDevice(): string {
    const ua = navigator.userAgent;
    if (/Mobi|Android/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  const device = detectDevice();

  // -----------------------------------------------------------------------
  // Deterministic hashing for variant assignment
  // -----------------------------------------------------------------------

  /**
   * FNV-1a 32-bit hash — fast, good distribution, no crypto overhead.
   */
  function fnv1a(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0; // ensure unsigned
  }

  /**
   * Deterministically assign a variant based on visitor+test hash.
   * Returns the variant or null if visitor falls outside traffic allocation.
   */
  function assignVariant(test: Test): Variant | null {
    const hash = fnv1a(visitorId! + ':' + test.id);
    const bucket = hash % 10000; // 0-9999 = 0.01% granularity

    // Traffic allocation: if bucket >= trafficPercent * 100, visitor is excluded
    if (bucket >= test.trafficPercent * 100) return null;

    // Distribute among variants by weight
    const totalWeight = test.variants.reduce((s, v) => s + v.weight, 0);
    if (totalWeight === 0) return null;

    const variantBucket = hash % totalWeight;
    let cumulative = 0;
    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (variantBucket < cumulative) return variant;
    }

    return test.variants[test.variants.length - 1];
  }

  // -----------------------------------------------------------------------
  // Mutual exclusion: if multiple tests target same page, pick one
  // -----------------------------------------------------------------------

  function applyMutualExclusion(tests: Test[]): Test[] {
    if (tests.length <= 1) return tests;

    // Use visitor hash to deterministically pick which test the visitor enters
    const hash = fnv1a(visitorId! + ':exclusion:' + tests.map(t => t.id).sort().join(','));
    const idx = hash % tests.length;
    return [tests[idx]];
  }

  // -----------------------------------------------------------------------
  // DOM change application
  // -----------------------------------------------------------------------

  function applyDOMChange(change: DOMChange): boolean {
    const el = document.querySelector(change.selector);
    if (!el) return false;

    switch (change.action) {
      case 'modify_text':
        if (change.value !== undefined) el.textContent = change.value;
        break;

      case 'replace_html':
        if (change.html !== undefined) el.innerHTML = change.html;
        break;

      case 'restyle':
        if (change.styles) {
          const htmlEl = el as HTMLElement;
          for (const [prop, val] of Object.entries(change.styles)) {
            htmlEl.style.setProperty(prop, val);
          }
        }
        break;

      case 'hide':
        (el as HTMLElement).style.display = 'none';
        break;

      case 'show':
        (el as HTMLElement).style.display = '';
        break;

      case 'move':
        if (change.targetSelector) {
          const target = document.querySelector(change.targetSelector);
          if (!target) return false;
          const pos = change.position || 'append';
          switch (pos) {
            case 'before': target.parentNode?.insertBefore(el, target); break;
            case 'after': target.parentNode?.insertBefore(el, target.nextSibling); break;
            case 'prepend': target.insertBefore(el, target.firstChild); break;
            case 'append': target.appendChild(el); break;
          }
        }
        break;

      case 'insert':
        if (change.html) {
          const pos = change.position || 'append';
          switch (pos) {
            case 'before': el.insertAdjacentHTML('beforebegin', change.html); break;
            case 'after': el.insertAdjacentHTML('afterend', change.html); break;
            case 'prepend': el.insertAdjacentHTML('afterbegin', change.html); break;
            case 'append': el.insertAdjacentHTML('beforeend', change.html); break;
          }
        }
        break;

      case 'delete':
        el.remove();
        break;

      case 'add_class':
        if (change.value) el.classList.add(...change.value.split(' '));
        break;

      case 'remove_class':
        if (change.value) el.classList.remove(...change.value.split(' '));
        break;
    }

    return true;
  }

  /**
   * Apply all DOM changes for a variant. For elements not yet in the DOM,
   * set up a MutationObserver to retry.
   */
  function applyVariantChanges(variant: Variant): void {
    const pendingChanges: DOMChange[] = [];

    // Apply CSS changes via a <style> tag
    if (variant.cssChanges) {
      const style = document.createElement('style');
      style.setAttribute('data-cro-variant', variant.id);
      style.textContent = variant.cssChanges;
      (document.head || document.documentElement).appendChild(style);
    }

    // Apply DOM changes
    for (const change of variant.domChanges) {
      if (!applyDOMChange(change)) {
        pendingChanges.push(change);
      }
    }

    // Watch for pending elements via MutationObserver
    if (pendingChanges.length > 0) {
      const observer = new MutationObserver(() => {
        for (let i = pendingChanges.length - 1; i >= 0; i--) {
          if (applyDOMChange(pendingChanges[i])) {
            pendingChanges.splice(i, 1);
          }
        }
        if (pendingChanges.length === 0) observer.disconnect();
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      // Safety timeout: stop watching after 10 seconds
      setTimeout(() => observer.disconnect(), 10000);
    }

    // Execute JS changes (if any)
    if (variant.jsChanges) {
      try {
        const fn = new Function(variant.jsChanges);
        fn();
      } catch (err) {
        console.warn('[CRO] JS change error:', err);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Event tracking
  // -----------------------------------------------------------------------

  let eventQueue: CROTrackEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const FLUSH_INTERVAL = 2000;
  const MAX_BATCH_SIZE = 50;

  function queueEvent(event: Omit<CROTrackEvent, 'visitorId' | 'sessionId' | 'device' | 'pageUrl' | 'timestamp'>): void {
    eventQueue.push({
      ...event,
      visitorId: visitorId!,
      sessionId: sessionId!,
      device,
      pageUrl: location.href,
      timestamp: Date.now(),
    });

    if (eventQueue.length >= MAX_BATCH_SIZE) {
      flushEvents();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL);
    }
  }

  function flushEvents(): void {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (!config || eventQueue.length === 0) return;

    const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
    const payload = JSON.stringify({
      events: batch,
      key: config.orgKey,
    });

    // Use sendBeacon for reliability (works during page unload)
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(config.apiUrl + '/api/snippet/events', blob);
      if (!sent) {
        // Fallback to fetch
        fetchEvents(payload, config.apiUrl);
      }
    } else {
      fetchEvents(payload, config.apiUrl);
    }
  }

  function fetchEvents(payload: string, apiUrl: string): void {
    fetch(apiUrl + '/api/snippet/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Silently fail — do not block the merchant's site
    });
  }

  // Flush on page hide / unload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents();
  });
  window.addEventListener('pagehide', flushEvents);

  // -----------------------------------------------------------------------
  // Scroll depth tracking
  // -----------------------------------------------------------------------

  function setupScrollTracking(assignments: VariantAssignment[]): void {
    const milestones = [25, 50, 75, 100];
    const fired = new Set<number>();

    function checkScroll(): void {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      ) - window.innerHeight;

      if (docHeight <= 0) return;

      const pct = Math.round((scrollTop / docHeight) * 100);

      for (const milestone of milestones) {
        if (pct >= milestone && !fired.has(milestone)) {
          fired.add(milestone);
          for (const a of assignments) {
            queueEvent({
              testId: a.testId,
              variantId: a.variantId,
              eventType: 'SCROLL',
              eventData: { depth: milestone },
            });
          }
        }
      }
    }

    let scrollRaf = 0;
    window.addEventListener('scroll', () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        checkScroll();
        scrollRaf = 0;
      });
    }, { passive: true });
  }

  // -----------------------------------------------------------------------
  // Click & form tracking (delegated)
  // -----------------------------------------------------------------------

  function setupClickTracking(assignments: VariantAssignment[]): void {
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target) return;

      const selector = buildSelector(target);

      for (const a of assignments) {
        queueEvent({
          testId: a.testId,
          variantId: a.variantId,
          eventType: 'CLICK',
          eventData: {
            selector,
            text: (target as HTMLElement).innerText?.substring(0, 100) || '',
            tagName: target.tagName,
          },
        });
      }

      // Detect Shopify add-to-cart
      if (isAddToCartClick(target)) {
        for (const a of assignments) {
          queueEvent({
            testId: a.testId,
            variantId: a.variantId,
            eventType: 'CONVERSION',
            eventData: { type: 'add_to_cart' },
          });
        }
      }
    }, { capture: true, passive: true });
  }

  function setupFormTracking(assignments: VariantAssignment[]): void {
    document.addEventListener('submit', (e: Event) => {
      const form = e.target as HTMLFormElement;
      if (!form) return;

      const action = form.action || '';
      for (const a of assignments) {
        queueEvent({
          testId: a.testId,
          variantId: a.variantId,
          eventType: 'FORM_SUBMIT',
          eventData: {
            formAction: action,
            formId: form.id || null,
          },
        });
      }
    }, { capture: true });
  }

  // -----------------------------------------------------------------------
  // Shopify-specific detection
  // -----------------------------------------------------------------------

  function isAddToCartClick(el: Element): boolean {
    // Common Shopify add-to-cart selectors and patterns
    const atcSelectors = [
      '[name="add"]',
      '.product-form__submit',
      '.add-to-cart',
      '.btn-add-to-cart',
      '[data-add-to-cart]',
      'button[type="submit"]',
    ];

    for (const sel of atcSelectors) {
      if (el.matches(sel) || el.closest(sel)) return true;
    }

    // Check form action
    const form = el.closest('form');
    if (form && /\/cart\/add/i.test(form.action)) return true;

    return false;
  }

  function isThankYouPage(): boolean {
    return /\/thank[-_]?you/i.test(location.pathname) ||
      /\/orders\/[^/]+\/confirm/i.test(location.pathname) ||
      location.pathname.includes('/checkouts/') && location.pathname.includes('/thank_you');
  }

  // -----------------------------------------------------------------------
  // Selector builder (for click tracking)
  // -----------------------------------------------------------------------

  function buildSelector(el: Element): string {
    if (el.id) return '#' + el.id;

    let selector = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).slice(0, 3);
      if (classes.length > 0 && classes[0]) {
        selector += '.' + classes.join('.');
      }
    }

    return selector;
  }

  // -----------------------------------------------------------------------
  // Read config from script tag attributes
  // -----------------------------------------------------------------------

  function readConfig(): CROConfig | null {
    // Check window.__CRO_CONFIG first
    const winConfig = (window as any).__CRO_CONFIG;
    if (winConfig && winConfig.apiUrl && winConfig.orgKey) {
      return { apiUrl: winConfig.apiUrl, orgKey: winConfig.orgKey };
    }

    // Read from script tag: <script src="..." data-key="pk_xxx" data-api="https://...">
    // data-api is optional — defaults to the script src origin
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-key]');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      const orgKey = script.getAttribute('data-key');
      if (!orgKey) continue;
      const dataApi = script.getAttribute('data-api');
      const apiUrl = dataApi || (script.src ? new URL(script.src).origin : location.origin);
      (window as any).__CRO_CONFIG = { apiUrl, orgKey };
      return { apiUrl, orgKey };
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Session storage cache for test config
  // -----------------------------------------------------------------------

  const CACHE_KEY = '_cro_tests';
  const CACHE_TTL = 60000; // 60 seconds

  function getCachedTests(): Test[] | null {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached.tests;
    } catch {
      return null;
    }
  }

  function setCachedTests(tests: Test[]): void {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ tests, ts: Date.now() }));
    } catch {
      // sessionStorage full or disabled — ignore
    }
  }

  // -----------------------------------------------------------------------
  // Assignment persistence (cookie)
  // -----------------------------------------------------------------------

  const ASSIGNMENT_COOKIE = '_cro_assign';

  function getStoredAssignments(): Record<string, string> {
    const raw = getCookie(ASSIGNMENT_COOKIE);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function storeAssignment(testId: string, variantId: string): void {
    const assignments = getStoredAssignments();
    assignments[testId] = variantId;
    setCookie(ASSIGNMENT_COOKIE, JSON.stringify(assignments));
  }

  // -----------------------------------------------------------------------
  // Main initialization
  // -----------------------------------------------------------------------

  async function init(): Promise<void> {
    if (!config) return;
    try {
      // Fetch tests (from cache or API)
      let tests = getCachedTests();
      if (!tests) {
        const url =
          config.apiUrl +
          '/api/snippet/tests?' +
          'key=' + encodeURIComponent(config.orgKey) +
          '&url=' + encodeURIComponent(location.href) +
          '&device=' + encodeURIComponent(device);

        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        tests = data.tests || [];
        setCachedTests(tests!);
      }

      if (!tests || tests.length === 0) return;

      // Apply mutual exclusion
      tests = applyMutualExclusion(tests);

      const assignments: VariantAssignment[] = [];
      const storedAssignments = getStoredAssignments();

      for (const test of tests) {
        let variant: Variant | null = null;

        // Check for existing assignment
        const storedVariantId = storedAssignments[test.id];
        if (storedVariantId) {
          variant = test.variants.find(v => v.id === storedVariantId) || null;
        }

        // If no stored assignment, assign deterministically
        if (!variant) {
          variant = assignVariant(test);
        }

        if (!variant) continue;

        // Persist assignment
        storeAssignment(test.id, variant.id);

        // Apply DOM changes (skip for control — it sees the original page)
        if (!variant.isControl) {
          applyVariantChanges(variant);
        }

        assignments.push({ testId: test.id, variantId: variant.id });

        // Track impression
        queueEvent({
          testId: test.id,
          variantId: variant.id,
          eventType: 'IMPRESSION',
        });
      }

      if (assignments.length === 0) return;

      // Set up event tracking
      setupClickTracking(assignments);
      setupFormTracking(assignments);
      setupScrollTracking(assignments);

      // Check if this is a Shopify thank-you page (conversion)
      if (isThankYouPage()) {
        // Try to extract order value from Shopify's checkout object
        const shopify = (window as any).Shopify;
        const revenue =
          shopify?.checkout?.total_price
            ? parseFloat(shopify.checkout.total_price)
            : null;

        for (const a of assignments) {
          queueEvent({
            testId: a.testId,
            variantId: a.variantId,
            eventType: 'CONVERSION',
            eventData: { type: 'purchase' },
            revenue: revenue ? revenue / 100 : null, // Shopify stores price in cents
          });
        }
      }
    } catch (err) {
      // Never throw — do not break the merchant's site
      if (typeof console !== 'undefined') {
        console.warn('[CRO] Initialization error:', err);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Start as early as possible
  // -----------------------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready — run immediately
    init();
  }
})();
