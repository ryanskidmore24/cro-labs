import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// Proxy API route — fetches a merchant's Shopify storefront,
// rewrites relative URLs to absolute, and injects the
// selection / editing script for the LiveEditor.
// ============================================================

const INJECTION_SCRIPT = `
<script>
(function() {
  if (window.__cro_injected) return;
  window.__cro_injected = true;

  var hovered = null;
  var selected = null;
  var OUTLINE_HOVER = '2px solid #3b82f6';
  var OUTLINE_SELECTED = '2px solid #2563eb';

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

  document.addEventListener('mouseover', function(e) {
    if (e.target === document.body || e.target === document.documentElement) return;
    if (hovered && hovered !== selected) hovered.style.outline = '';
    hovered = e.target;
    if (hovered !== selected) hovered.style.outline = OUTLINE_HOVER;
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (hovered && hovered !== selected) hovered.style.outline = '';
  }, true);

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (selected) { selected.style.outline = ''; }
    selected = e.target;
    selected.style.outline = OUTLINE_SELECTED;

    window.parent.postMessage({
      type: 'element-selected',
      selector: getSelector(selected),
      tagName: selected.tagName,
      textContent: (selected.textContent || '').trim().substring(0, 200),
      styles: getComputedStyles(selected),
      attributes: getAttributes(selected),
      outerHTML: selected.outerHTML.substring(0, 2000),
    }, '*');
  }, true);

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
</script>
`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const raw = searchParams.get('raw'); // If '1', return raw HTML without injection
  const changesParam = searchParams.get('changes'); // For preview mode

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Missing required "url" query parameter' },
      { status: 400 },
    );
  }

  // Basic URL validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL provided' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch target URL: ${response.status}` },
        { status: response.status },
      );
    }

    let html = await response.text();

    // Rewrite relative URLs to absolute
    const origin = parsedUrl.origin;

    // Rewrite src, href, action attributes that start with /
    html = html.replace(
      /((?:src|href|action)\s*=\s*["'])\/(?!\/)/gi,
      `$1${origin}/`,
    );

    // Rewrite url() in CSS that starts with /
    html = html.replace(
      /(url\(\s*["']?)\/(?!\/)/gi,
      `$1${origin}/`,
    );

    // Add <base> tag for any remaining relative URLs
    if (!html.includes('<base')) {
      html = html.replace(
        /(<head[^>]*>)/i,
        `$1\n<base href="${origin}/">`,
      );
    }

    // If raw mode requested, return as-is (for canvas parsing)
    if (raw === '1') {
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'X-Frame-Options': 'ALLOWALL',
        },
      });
    }

    // Inject the selection script before </body>
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${INJECTION_SCRIPT}\n</body>`);
    } else {
      html += INJECTION_SCRIPT;
    }

    // If changes provided (preview mode), inject a script to apply them
    if (changesParam) {
      try {
        const changes = JSON.parse(decodeURIComponent(changesParam));
        const applyScript = `
<script>
(function(){
  var changes = ${JSON.stringify(changes)};
  function apply() {
    changes.forEach(function(c) {
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
          if (c.property === 'style.cssText') el.style.cssText += c.newValue;
          else if (c.property && c.property.startsWith('style.')) el.style[c.property.replace('style.', '')] = c.newValue;
          break;
        case 'hide': el.style.display = 'none'; break;
        case 'show': el.style.display = ''; break;
        case 'delete': el.remove(); break;
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
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
</script>`;
        html = html.replace('</body>', `${applyScript}\n</body>`);
      } catch {
        // Ignore malformed changes param
      }
    }

    // Remove X-Frame-Options and CSP headers that would block iframe embedding
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'ALLOWALL',
        'Content-Security-Policy': '',
      },
    });
  } catch (err) {
    console.error('Proxy fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch the target URL' },
      { status: 502 },
    );
  }
}
