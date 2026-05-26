import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  GA4AnalysisInput,
  DataInsights,
  SearchConsoleInput,
  SearchInsights,
  ClarityInput,
  BehaviorInsights,
  CrossPlatformInput,
  UnifiedInsights,
} from "./types";

// ─── Client Setup ───────────────────────────────────────────────────────────

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

const MODEL = "gemini-2.0-flash";

// ─── JSON Extraction Helper ─────────────────────────────────────────────────

function extractJson<T>(text: string): T {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim()) as T;
  }
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]) as T;
  }
  throw new Error("No valid JSON found in AI response");
}

// ─── System Prompts ─────────────────────────────────────────────────────────

const GA4_ANALYSIS_PROMPT = `You are a data analyst specializing in e-commerce analytics, specifically Google Analytics 4 (GA4) data interpretation. Your role is to find actionable patterns, anomalies, and optimization opportunities in GA4 data.

## Analysis Methodology:

### Funnel Analysis
- Compare step-to-step drop-off rates against e-commerce benchmarks:
  - Homepage → Collection: typical 40-60% proceed
  - Collection → PDP: typical 30-50% proceed
  - PDP → Add to Cart: typical 8-15% proceed
  - Add to Cart → Checkout: typical 50-70% proceed
  - Checkout → Purchase: typical 40-65% proceed
- Flag any step with drop-off >1.5x the benchmark rate
- Calculate estimated lost revenue at each step: (users_dropped * overall_CVR_of_remaining_steps * AOV)

### Traffic Source Quality
- High-quality sources: high session duration, low bounce, high conversion
- Low-quality sources: high bounce (>70%), low session duration (<30s), zero conversions
- Flag sources with significant traffic but zero or near-zero conversions
- Identify sources with above-average conversion rates (potential for scaling)

### Device Analysis
- Compare mobile vs desktop conversion rates — mobile is typically 40-60% of desktop CVR
- If mobile CVR is <30% of desktop, flag as critical mobile UX issue
- Check if mobile bounce rate is >20% higher than desktop (indicates mobile UX problems)
- Evaluate tablet as a separate segment (often overlooked)

### Anomaly Detection
- Compare metrics against rolling averages and expected ranges
- Flag sudden changes (>20% deviation from baseline)
- Look for day-of-week patterns that suggest specific user behaviors
- Identify pages with metrics that significantly deviate from site averages

## Output Format:
Return a JSON object with:
- summary: string (top-level narrative of findings)
- patterns: array of { name, description, significance ("low"|"medium"|"high"), affectedMetric, dataPoints: string[] }
- anomalies: array of { metric, expected, actual, deviationPercent, possibleCauses: string[], severity }
- funnelAnalysis: { overallConversionRate, biggestDropoffStep, dropoffRate, estimatedLostRevenue, recommendations: string[] } (optional)
- deviceInsights: array of { device, finding, severity, recommendation } (optional)
- trafficQuality: array of { source, medium, quality ("high"|"medium"|"low"), reason, conversionRate, bounceRate } (optional)`;

const SEARCH_CONSOLE_PROMPT = `You are an SEO data analyst specializing in e-commerce search performance. You analyze Google Search Console data to find keyword opportunities, content gaps, and pages that can be improved for better organic traffic.

## Analysis Methodology:

### Keyword Opportunity Identification
- High impressions + low CTR (CTR < position-expected CTR) = title/meta description problem
  - Position 1-3: expected CTR 15-40%
  - Position 4-6: expected CTR 5-15%
  - Position 7-10: expected CTR 2-5%
- If CTR is >30% below position-expected average, flag as opportunity

### Quick Wins (Low-Hanging Fruit)
- Keywords ranking position 8-20 with high impressions
- These could move to page 1 with focused optimization
- Estimate additional clicks: (target_position_CTR - current_CTR) * impressions

### Content Gap Analysis
- Look for query clusters that indicate topics your store should cover
- Identify branded vs non-branded query mix (healthy ratio: 30-70% non-branded)
- Find queries with high impressions but no dedicated landing page

### Page Performance
- Pages with high impressions but low CTR need better titles/descriptions
- Pages with declining position trends need content refresh
- Pages with high CTR but low impressions may benefit from content expansion

## Output Format:
Return a JSON object with:
- summary: string (overview of search performance health)
- keywordOpportunities: array of { query, impressions, currentCtr, currentPosition, estimatedClicksGained, recommendation }
- contentGaps: array of { topicArea, relatedQueries: string[], estimatedMonthlySearches, recommendation }
- underperformingPages: array of { pageUrl, impressions, ctr, avgPosition, issues: string[], recommendations: string[] }
- quickWins: array of { query, currentPosition, impressions, estimatedAdditionalClicks, recommendation }`;

const CLARITY_ANALYSIS_PROMPT = `You are a UX analytics specialist who interprets Microsoft Clarity behavioral data to identify user experience problems and conversion friction. You understand how to translate behavioral signals into actionable UX improvements.

## Analysis Methodology:

### Rage Click Analysis
- Rage clicks indicate user frustration — element appears interactive but isn't, or doesn't respond fast enough
- High rage click areas often correlate with conversion friction
- Priority: rage clicks on/near CTAs > rage clicks on navigation > rage clicks on content

### Dead Click Analysis
- Dead clicks suggest visual design misleads users (element looks clickable but isn't)
- Common causes: styled text that looks like links, images without click handlers, disabled buttons without clear disabled state
- Fix by either making the element interactive or changing its visual design

### Scroll Depth Analysis
- If critical content (CTAs, pricing, reviews) is below the average scroll depth, users aren't seeing it
- Good PDP scroll depth: 60-80% reach product details, 40-60% reach reviews
- If <30% reach below-the-fold content, consider restructuring information hierarchy

### Quick Back Analysis
- Quick backs (user arrives, immediately goes back) indicate:
  - Content didn't match search intent
  - Page load issues
  - Misleading navigation labels
  - Wrong landing page for the traffic source

### Session Pattern Analysis
- Look for common session paths that indicate confusion
- Identify "ping-pong" navigation (user goes back and forth between pages)
- High page-per-session with low conversion = browsing without buying = possible decision paralysis

## Output Format:
Return a JSON object with:
- summary: string (overall UX health assessment)
- frictionPoints: array of { pageUrl, type, severity ("low"|"medium"|"high"|"critical"), description, affectedSessions, selector?, recommendation }
- scrollAnalysis: { averageDepth, contentBelowFold, recommendation } (optional)
- clickPatterns: array of { description, significance, recommendation } (optional)
- sessionPatterns: array of { pattern, frequency, insight } (optional)`;

const CROSS_PLATFORM_PROMPT = `You are a senior e-commerce analytics strategist who synthesizes data from multiple sources (GA4, Google Search Console, Microsoft Clarity) to produce a unified, actionable analysis. Your strength is finding corroborations across data sources — when multiple signals point to the same problem, confidence is much higher.

## Cross-Platform Corroboration Rules:

### High Confidence Findings (confirmed by 2+ sources)
- GA4 high bounce rate + Clarity quick backs on same page = definite landing page problem
- GA4 mobile CVR gap + Clarity mobile rage clicks = mobile UX issue
- Search Console high impressions/low CTR + GA4 high bounce on same page = intent mismatch
- GA4 funnel drop-off at cart + Clarity dead clicks on checkout button = checkout UX friction
- GA4 low session duration + Clarity low scroll depth = content engagement problem

### Revenue Opportunity Calculation
- Funnel leaks: (dropped_users * downstream_CVR * AOV) = revenue opportunity
- Mobile gap: (mobile_sessions * (desktop_CVR - mobile_CVR) * AOV) = mobile revenue opportunity
- SEO gaps: estimated_additional_clicks * organic_CVR * AOV = SEO revenue opportunity
- UX fixes: affected_sessions * estimated_CVR_improvement * AOV = UX revenue opportunity

### Store Health Score (0-100)
Calculate based on:
- Traffic Quality (25 points): bounce rate, session duration, source diversity
- User Experience (25 points): rage clicks, dead clicks, scroll depth, mobile parity
- Conversion Efficiency (25 points): funnel completion rate, CVR vs benchmarks, cart abandonment
- Search Visibility (25 points): organic traffic share, keyword coverage, CTR performance

## Priority Ranking
Rank actions by: (estimated_revenue_impact * confidence) / effort_level
- HIGH impact + LOW effort = do first
- HIGH impact + HIGH effort = plan for next sprint
- LOW impact + LOW effort = batch together
- LOW impact + HIGH effort = deprioritize

## Output Format:
Return a JSON object with:
- executiveSummary: string (3-5 sentence C-suite summary)
- corroboratedFindings: array of { finding, dataSources: string[], confidence ("medium"|"high"|"very_high"), impact ("low"|"medium"|"high"), details }
- prioritizedActions: array of { rank, action, rationale, estimatedImpact, effort ("LOW"|"MEDIUM"|"HIGH"), dataSources: string[] }
- revenueOpportunities: array of { area, description, estimatedMonthlyRevenue, confidence ("low"|"medium"|"high"), requiredActions: string[] }
- storeHealthScore: number (0-100)
- categoryScores: { trafficQuality: number, userExperience: number, conversionEfficiency: number, searchVisibility: number }`;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Analyze GA4 funnel/traffic data to identify patterns,
 * anomalies, and drop-offs.
 */
export async function analyzeGA4Data(
  ga4Data: GA4AnalysisInput
): Promise<DataInsights> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const prompt = buildGA4Prompt(ga4Data);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { role: "model", parts: [{ text: GA4_ANALYSIS_PROMPT }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });

  const text = result.response.text();
  return extractJson<DataInsights>(text);
}

/**
 * Analyze Search Console data to find keyword opportunities,
 * content gaps, and underperforming pages.
 */
export async function analyzeSearchConsoleData(
  scData: SearchConsoleInput
): Promise<SearchInsights> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const prompt = buildSearchConsolePrompt(scData);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { role: "model", parts: [{ text: SEARCH_CONSOLE_PROMPT }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });

  const text = result.response.text();
  return extractJson<SearchInsights>(text);
}

/**
 * Interpret Clarity heatmap/session data and identify UX friction.
 */
export async function analyzeClarityData(
  clarityData: ClarityInput
): Promise<BehaviorInsights> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const prompt = buildClarityPrompt(clarityData);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { role: "model", parts: [{ text: CLARITY_ANALYSIS_PROMPT }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });

  const text = result.response.text();
  return extractJson<BehaviorInsights>(text);
}

/**
 * Combine GA4 + Search Console + Clarity data for a holistic,
 * cross-platform analysis with corroborated findings.
 */
export async function crossPlatformAnalysis(
  allData: CrossPlatformInput
): Promise<UnifiedInsights> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const prompt = buildCrossPlatformPrompt(allData);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { role: "model", parts: [{ text: CROSS_PLATFORM_PROMPT }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  const text = result.response.text();
  return extractJson<UnifiedInsights>(text);
}

// ─── Prompt Builders ────────────────────────────────────────────────────────

function buildGA4Prompt(data: GA4AnalysisInput): string {
  const sections: string[] = [];

  sections.push(`## Analysis Period: ${data.dateRange.startDate} to ${data.dateRange.endDate}`);
  if (data.storeName) sections.push(`## Store: ${data.storeName}`);

  if (data.funnelData && data.funnelData.length > 0) {
    sections.push(`## Funnel Data
${data.funnelData
  .map(
    (step) =>
      `| ${step.stepName} | ${step.eventName} | ${step.activeUsers.toLocaleString()} users | CVR: ${(step.conversionRate * 100).toFixed(1)}% | Drop-off: ${(step.dropoffRate * 100).toFixed(1)}% |`
  )
  .join("\n")}`);
  }

  if (data.pageMetrics && data.pageMetrics.length > 0) {
    sections.push(`## Page Metrics (${data.pageMetrics.length} pages)
${data.pageMetrics
  .slice(0, 30)
  .map(
    (p) =>
      `| ${p.pagePath} | ${p.pageViews.toLocaleString()} views | ${(p.bounceRate * 100).toFixed(1)}% bounce | ${p.avgSessionDuration.toFixed(0)}s avg | ${p.uniqueUsers.toLocaleString()} users |`
  )
  .join("\n")}`);
  }

  if (data.userFlowData && data.userFlowData.length > 0) {
    sections.push(`## User Flow (Top ${Math.min(data.userFlowData.length, 20)} paths)
${data.userFlowData
  .slice(0, 20)
  .map(
    (f) =>
      `| ${f.previousPagePath} → ${f.pagePath} | ${f.sessions.toLocaleString()} sessions | ${(f.percentage * 100).toFixed(1)}% |`
  )
  .join("\n")}`);
  }

  if (data.trafficSources && data.trafficSources.length > 0) {
    sections.push(`## Traffic Sources
${data.trafficSources
  .map(
    (t) =>
      `| ${t.source}/${t.medium} | ${t.sessions.toLocaleString()} sessions | ${t.users.toLocaleString()} users | ${t.conversions} conversions | ${(t.bounceRate * 100).toFixed(1)}% bounce |`
  )
  .join("\n")}`);
  }

  if (data.deviceBreakdown && data.deviceBreakdown.length > 0) {
    sections.push(`## Device Breakdown
${data.deviceBreakdown
  .map(
    (d) =>
      `| ${d.deviceCategory} | ${d.sessions.toLocaleString()} sessions | ${(d.conversionRate * 100).toFixed(2)}% CVR | ${(d.bounceRate * 100).toFixed(1)}% bounce | ${d.avgSessionDuration.toFixed(0)}s avg |`
  )
  .join("\n")}`);
  }

  if (data.conversionEvents && data.conversionEvents.length > 0) {
    sections.push(`## Conversion Events
${data.conversionEvents
  .map(
    (c) =>
      `| ${c.eventName} | ${c.eventCount.toLocaleString()} events | $${c.totalRevenue.toLocaleString()} revenue | ${c.uniqueUsers.toLocaleString()} users |`
  )
  .join("\n")}`);
  }

  sections.push(
    "\nAnalyze this GA4 data for patterns, anomalies, and optimization opportunities. Return valid JSON only."
  );

  return sections.join("\n\n");
}

function buildSearchConsolePrompt(data: SearchConsoleInput): string {
  const sections: string[] = [];

  sections.push(`## Analysis Period: ${data.dateRange.startDate} to ${data.dateRange.endDate}`);
  if (data.storeName) sections.push(`## Store: ${data.storeName}`);
  if (data.storeUrl) sections.push(`## URL: ${data.storeUrl}`);

  if (data.searchQueries.length > 0) {
    sections.push(`## Search Queries (${data.searchQueries.length} queries)
${data.searchQueries
  .slice(0, 50)
  .map(
    (q) =>
      `| "${q.query}" | ${q.impressions.toLocaleString()} imp | ${q.clicks.toLocaleString()} clicks | ${(q.ctr * 100).toFixed(1)}% CTR | pos ${q.position.toFixed(1)} |`
  )
  .join("\n")}`);
  }

  if (data.pagePerformance.length > 0) {
    sections.push(`## Page Performance (${data.pagePerformance.length} pages)
${data.pagePerformance
  .slice(0, 30)
  .map(
    (p) =>
      `| ${p.page} | ${p.impressions.toLocaleString()} imp | ${p.clicks.toLocaleString()} clicks | ${(p.ctr * 100).toFixed(1)}% CTR | pos ${p.position.toFixed(1)} |`
  )
  .join("\n")}`);
  }

  sections.push(
    "\nAnalyze this Search Console data for SEO opportunities, content gaps, and quick wins. Return valid JSON only."
  );

  return sections.join("\n\n");
}

function buildClarityPrompt(data: ClarityInput): string {
  const sections: string[] = [];

  sections.push(`## Analysis Period: ${data.dateRange.startDate} to ${data.dateRange.endDate}`);
  if (data.storeName) sections.push(`## Store: ${data.storeName}`);

  if (data.dashboardMetrics) {
    const m = data.dashboardMetrics;
    sections.push(`## Dashboard Overview
- Total Sessions: ${m.totalSessions.toLocaleString()}
- Total Page Views: ${m.totalPageViews.toLocaleString()}
- Distinct Users: ${m.distinctUsers.toLocaleString()}
- Avg Session Duration: ${m.avgSessionDuration.toFixed(0)}s
- Bounce Rate: ${(m.bounceRate * 100).toFixed(1)}%
- Avg Scroll Depth: ${(m.scrollDepthAvg * 100).toFixed(1)}%
- Rage Clicks: ${m.rageClicks.toLocaleString()}
- Dead Clicks: ${m.deadClicks.toLocaleString()}
- Excessive Scrolls: ${m.excessiveScrolls.toLocaleString()}
- Quick Backs: ${m.quickBacks.toLocaleString()}
- Error Clicks: ${m.errorClicks.toLocaleString()}`);
  }

  if (data.smartEvents && data.smartEvents.length > 0) {
    sections.push(`## Smart Events (${data.smartEvents.length} events)
${data.smartEvents
  .map(
    (e) =>
      `| ${e.eventType} | ${e.pageUrl} | ${e.selector ?? "N/A"} | ${e.count} occurrences | ${e.affectedSessions} sessions | ${e.firstSeen} - ${e.lastSeen} |`
  )
  .join("\n")}`);
  }

  if (data.heatmapData && data.heatmapData.length > 0) {
    for (const heatmap of data.heatmapData.slice(0, 5)) {
      const topClicks = heatmap.clicks
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      sections.push(`## Heatmap: ${heatmap.pageUrl} (${heatmap.totalSessions.toLocaleString()} sessions)

### Top Click Areas
${topClicks
  .map(
    (c) =>
      `- (${c.x}, ${c.y})${c.selector ? ` [${c.selector}]` : ""}: ${c.count} clicks`
  )
  .join("\n")}

### Scroll Depth
${heatmap.scrollDepth
  .map(
    (s) =>
      `- ${s.depthPercent}%: ${s.usersReached.toLocaleString()} users (${(s.percentageOfTotal * 100).toFixed(1)}% of total)`
  )
  .join("\n")}`);
    }
  }

  sections.push(
    "\nAnalyze this Clarity behavioral data for UX friction points and optimization opportunities. Return valid JSON only."
  );

  return sections.join("\n\n");
}

function buildCrossPlatformPrompt(data: CrossPlatformInput): string {
  const sections: string[] = [];

  sections.push(`## Analysis Period: ${data.dateRange.startDate} to ${data.dateRange.endDate}`);

  if (data.storeMetrics) {
    const m = data.storeMetrics;
    sections.push(`## Store Overview
- Store ID: ${m.storeId}
- Total Sessions: ${m.totalSessions.toLocaleString()}
- Total Revenue: $${m.totalRevenue.toLocaleString()}
- Total Orders: ${m.totalOrders.toLocaleString()}
- Overall CVR: ${(m.conversionRate * 100).toFixed(2)}%
- AOV: $${m.averageOrderValue.toFixed(2)}
${m.returningCustomerRate != null ? `- Returning Customer Rate: ${(m.returningCustomerRate * 100).toFixed(1)}%` : ""}`);
  }

  // Embed summarized data from each platform
  if (data.ga4Data) {
    const ga4 = data.ga4Data;
    const subsections: string[] = ["## GA4 Data Summary"];

    if (ga4.funnelData && ga4.funnelData.length > 0) {
      subsections.push(`### Funnel
${ga4.funnelData
  .map(
    (s) =>
      `- ${s.stepName}: ${s.activeUsers.toLocaleString()} users, ${(s.dropoffRate * 100).toFixed(1)}% drop-off`
  )
  .join("\n")}`);
    }

    if (ga4.deviceBreakdown && ga4.deviceBreakdown.length > 0) {
      subsections.push(`### Devices
${ga4.deviceBreakdown
  .map(
    (d) =>
      `- ${d.deviceCategory}: ${d.sessions.toLocaleString()} sessions, ${(d.conversionRate * 100).toFixed(2)}% CVR, ${(d.bounceRate * 100).toFixed(1)}% bounce`
  )
  .join("\n")}`);
    }

    if (ga4.trafficSources && ga4.trafficSources.length > 0) {
      subsections.push(`### Traffic Sources (Top 10)
${ga4.trafficSources
  .slice(0, 10)
  .map(
    (t) =>
      `- ${t.source}/${t.medium}: ${t.sessions.toLocaleString()} sessions, ${t.conversions} conversions, ${(t.bounceRate * 100).toFixed(1)}% bounce`
  )
  .join("\n")}`);
    }

    if (ga4.pageMetrics && ga4.pageMetrics.length > 0) {
      subsections.push(`### Top Pages by Traffic (Top 15)
${ga4.pageMetrics
  .slice(0, 15)
  .map(
    (p) =>
      `- ${p.pagePath}: ${p.pageViews.toLocaleString()} views, ${(p.bounceRate * 100).toFixed(1)}% bounce`
  )
  .join("\n")}`);
    }

    sections.push(subsections.join("\n\n"));
  }

  if (data.searchConsoleData) {
    const sc = data.searchConsoleData;
    const subsections: string[] = ["## Search Console Data Summary"];

    if (sc.searchQueries.length > 0) {
      subsections.push(`### Top Queries (Top 20)
${sc.searchQueries
  .slice(0, 20)
  .map(
    (q) =>
      `- "${q.query}": ${q.impressions.toLocaleString()} imp, ${(q.ctr * 100).toFixed(1)}% CTR, pos ${q.position.toFixed(1)}`
  )
  .join("\n")}`);
    }

    if (sc.pagePerformance.length > 0) {
      subsections.push(`### Top Pages (Top 15)
${sc.pagePerformance
  .slice(0, 15)
  .map(
    (p) =>
      `- ${p.page}: ${p.impressions.toLocaleString()} imp, ${(p.ctr * 100).toFixed(1)}% CTR, pos ${p.position.toFixed(1)}`
  )
  .join("\n")}`);
    }

    sections.push(subsections.join("\n\n"));
  }

  if (data.clarityData) {
    const cl = data.clarityData;
    const subsections: string[] = ["## Clarity Data Summary"];

    if (cl.dashboardMetrics) {
      const m = cl.dashboardMetrics;
      subsections.push(`### Dashboard
- Sessions: ${m.totalSessions.toLocaleString()}, Bounce: ${(m.bounceRate * 100).toFixed(1)}%, Scroll Depth: ${(m.scrollDepthAvg * 100).toFixed(1)}%
- Rage Clicks: ${m.rageClicks}, Dead Clicks: ${m.deadClicks}, Quick Backs: ${m.quickBacks}`);
    }

    if (cl.smartEvents && cl.smartEvents.length > 0) {
      subsections.push(`### Smart Events (Top 15)
${cl.smartEvents
  .slice(0, 15)
  .map(
    (e) =>
      `- ${e.eventType} on ${e.pageUrl}: ${e.count} occurrences, ${e.affectedSessions} sessions`
  )
  .join("\n")}`);
    }

    sections.push(subsections.join("\n\n"));
  }

  sections.push(
    "\nSynthesize all available data sources into a unified analysis. Prioritize corroborated findings (confirmed by multiple sources). Calculate revenue opportunities where possible. Return valid JSON only."
  );

  return sections.join("\n\n");
}
