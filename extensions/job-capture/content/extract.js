/**
 * Content script — runs in the already-loaded page context.
 * Extracts job details purely from the existing DOM. Never makes any network
 * requests; completely invisible to the job site.
 *
 * Priority order:
 *   1. JSON-LD  @type: "JobPosting"
 *   2. Open Graph / meta tags
 *   3. DOM heuristics (headings, aria-labels, common class/id patterns)
 */

(function () {
  'use strict';

  // ── 1. JSON-LD ─────────────────────────────────────────────────────────────

  function extractFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const nodes = Array.isArray(data) ? data : [data];
        for (const node of nodes) {
          if (node['@type'] === 'JobPosting') {
            const company =
              node.hiringOrganization?.name ||
              node.hiringOrganization?.['@name'] ||
              '';
            const role = node.title || node.name || '';
            const location =
              typeof node.jobLocation === 'string'
                ? node.jobLocation
                : node.jobLocation?.address?.addressLocality ||
                  node.jobLocation?.address?.name ||
                  '';
            return { company: company.trim(), role: role.trim(), location: location.trim() };
          }
        }
      } catch {
        // malformed JSON-LD — skip
      }
    }
    return null;
  }

  // ── 2. Meta / Open Graph tags ───────────────────────────────────────────────

  function metaContent(name) {
    return (
      document.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
      document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
      ''
    );
  }

  function extractFromMeta() {
    const ogTitle = metaContent('og:title');
    const siteName = metaContent('og:site_name');
    // og:title is often "Role at Company" or "Company - Role"
    const atMatch = ogTitle.match(/^(.+?)\s+at\s+(.+)$/i);
    const dashMatch = ogTitle.match(/^(.+?)\s*[-–|]\s*(.+)$/);
    let role = '';
    let company = '';
    if (atMatch) {
      role = atMatch[1].trim();
      company = atMatch[2].trim();
    } else if (dashMatch) {
      role = dashMatch[1].trim();
      company = dashMatch[2].trim();
    } else {
      role = ogTitle.trim();
    }
    if (!company && siteName) company = siteName.trim();
    return role ? { role, company, location: '' } : null;
  }

  // ── 3. DOM heuristics ───────────────────────────────────────────────────────

  /** Return text of the first element matching any selector, trimmed. */
  function firstText(...selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim();
      } catch {
        // invalid selector — skip
      }
    }
    return '';
  }

  function extractFromDom() {
    const role = firstText(
      // Generic job title patterns
      '[class*="job-title"]',
      '[class*="jobTitle"]',
      '[class*="JobTitle"]',
      '[id*="job-title"]',
      '[id*="jobTitle"]',
      '[data-testid*="job-title"]',
      '[data-automation*="job-title"]',
      // Heading: h1 is almost always the posting title on a job detail page
      'h1',
    );

    const company = firstText(
      '[class*="company-name"]',
      '[class*="companyName"]',
      '[class*="CompanyName"]',
      '[class*="employer-name"]',
      '[class*="org-name"]',
      '[data-testid*="company-name"]',
      '[data-automation*="company-name"]',
      // Fallback: second-level heading often contains company
      'h2',
    );

    const location = firstText(
      '[class*="location"]',
      '[class*="Location"]',
      '[data-testid*="location"]',
      '[data-automation*="location"]',
    );

    return role ? { role: role.slice(0, 200), company: company.slice(0, 200), location: location.slice(0, 200) } : null;
  }

  // ── Page title fallback ─────────────────────────────────────────────────────

  function extractFromTitle() {
    const t = document.title;
    const atMatch = t.match(/^(.+?)\s+at\s+(.+?)(?:\s*[-–|]|$)/i);
    if (atMatch) return { role: atMatch[1].trim(), company: atMatch[2].trim(), location: '' };
    const dashMatch = t.match(/^(.+?)\s*[-–|]\s*(.+?)(?:\s*[-–|]|$)/);
    if (dashMatch) return { role: dashMatch[1].trim(), company: dashMatch[2].trim(), location: '' };
    return { role: t.trim().slice(0, 200), company: '', location: '' };
  }

  // ── Merge results (earlier strategies win non-empty fields) ─────────────────

  function merge(...results) {
    const out = { role: '', company: '', location: '' };
    for (const r of results) {
      if (!r) continue;
      if (!out.role    && r.role)     out.role     = r.role;
      if (!out.company && r.company)  out.company  = r.company;
      if (!out.location && r.location) out.location = r.location;
    }
    return out;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function extractJobData() {
    const result = merge(
      extractFromJsonLd(),
      extractFromMeta(),
      extractFromDom(),
      extractFromTitle(),
    );
    return {
      ...result,
      link: window.location.href,
    };
  }

  // Listen for messages from the popup
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'EXTRACT_JOB') {
      sendResponse(extractJobData());
    }
  });
})();
