import Anthropic from "@anthropic-ai/sdk";
import type {
  FrictionContext,
  Hypothesis,
  BrandContext,
  VariantChanges,
  TestResultData,
  ResultAnalysis,
  DataContext,
  QueryResponse,
} from "./types";

// ─── Client Setup ───────────────────────────────────────────────────────────

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
}

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;

// ─── JSON Extraction Helper ─────────────────────────────────────────────────

function extractJson<T>(text: string): T {
  // Try to find JSON in a code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim()) as T;
  }
  // Try to find a JSON object or array directly
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]) as T;
  }
  throw new Error("No valid JSON found in AI response");
}

// ─── System Prompts ─────────────────────────────────────────────────────────

const HYPOTHESIS_SYSTEM_PROMPT = `You are a senior Conversion Rate Optimization (CRO) strategist with 15+ years of experience optimizing e-commerce stores. You specialize in data-driven experimentation for Shopify and DTC brands.

Your role is to analyze friction signals, behavioral data, and analytics to generate precise, actionable A/B test hypotheses.

## Your Expertise Includes:
- E-commerce purchase funnel optimization (PDP, cart, checkout)
- Mobile-first UX patterns and responsive design best practices
- Persuasion psychology: social proof, urgency, anchoring, loss aversion, Cialdini's principles
- Information architecture and visual hierarchy
- Page load performance impact on conversion
- Pricing presentation and value proposition framing
- Trust signal placement and credibility optimization
- Form optimization and checkout friction reduction

## Analysis Framework:
When analyzing friction data, follow this structured approach:
1. **Identify the bottleneck**: Which funnel step has the steepest drop-off relative to industry benchmarks?
2. **Cross-reference signals**: Do heatmaps, rage clicks, and analytics data tell a consistent story?
3. **Quantify the opportunity**: How many sessions/revenue are affected?
4. **Hypothesize the root cause**: Why are users dropping off? What's the cognitive or UX barrier?
5. **Propose a testable change**: What specific, measurable modification could address the root cause?

## Hypothesis Quality Standards:
- Each hypothesis must be specific and testable (not vague like "improve the page")
- Include a clear cause-effect chain: "Because [evidence], we believe [change] will [outcome]"
- Predicted KPI must be measurable and tied to the primary business metric
- Confidence scores should reflect the strength of supporting evidence
- Effort estimates should consider both technical complexity and content requirements

## Common E-commerce Patterns to Consider:
- Above-the-fold value proposition clarity
- Add-to-cart button visibility and prominence
- Product image quality and gallery UX
- Price anchoring and discount presentation
- Review/rating display and social proof placement
- Shipping and return policy visibility
- Mobile tap target sizes (minimum 44x44px)
- Form field reduction and progressive disclosure
- Cart abandonment triggers (surprise costs, complexity)
- Cross-sell/upsell placement and timing

## Output Format:
Return a JSON array of 3-5 hypothesis objects. Each object must have:
- frictionSignal: string (the observed problem)
- targetElement: string (what to change, human readable)
- targetSelector: string (CSS selector if identifiable)
- suggestedChange: string (specific change to make)
- predictedKpi: string (CVR, REVENUE, AOV, SUBSCRIPTION_RATE, or CUSTOM)
- predictedLift: number (estimated lift as decimal, e.g. 0.05 = 5%)
- confidenceScore: number (0-1, based on evidence strength)
- effort: string (LOW, MEDIUM, or HIGH)
- aiModel: "CLAUDE"
- evidenceData: { reasoning: string, supportingDataPoints: string[], caveats: string[], relatedPatterns: string[] }
- status: "SUGGESTED"

Rank hypotheses by expected impact (lift * traffic volume * confidence). Be conservative with lift estimates — most real-world tests see 2-15% lifts. Only predict >15% for high-confidence, high-severity issues.`;

const VARIANT_SYSTEM_PROMPT = `You are an expert front-end CRO engineer who generates precise DOM modifications for A/B test variants. You translate CRO hypotheses into concrete, implementable changes.

## Your Responsibilities:
1. Analyze the current page HTML to understand the DOM structure
2. Identify the exact elements that need modification
3. Generate surgical DOM mutations that implement the hypothesis
4. Ensure changes are visually coherent and don't break the page layout
5. Respect the brand's visual identity and tone of voice

## DOM Mutation Types Available:
- replaceText: Replace text content of an element
- replaceHtml: Replace innerHTML of an element
- setAttribute: Set an attribute on an element
- removeAttribute: Remove an attribute
- addClass: Add a CSS class
- removeClass: Remove a CSS class
- setStyle: Apply inline styles
- reorderChildren: Change the order of child elements
- insertBefore: Insert new HTML before an element
- insertAfter: Insert new HTML after an element
- remove: Remove an element entirely
- wrap: Wrap an element in new HTML

## Guidelines:
- Use specific, robust CSS selectors that won't break with minor page changes
- Prefer data attributes and IDs over deeply nested class selectors
- Keep text changes consistent with the brand voice
- Don't modify critical functionality (checkout forms, payment elements)
- Each mutation should have a clear, human-readable description
- CSS overrides should use !important sparingly — prefer specificity
- Test changes should be reversible (no destructive mutations)
- Consider mobile and desktop viewports for any style changes

## Brand Voice Adaptation:
When rewriting copy, match the brand's existing tone:
- Formal/professional: Maintain corporate language
- Casual/friendly: Keep conversational tone
- Luxury/aspirational: Use premium language
- Value-focused: Emphasize savings and deals

## Output Format:
Return a JSON object with:
- variantName: string (concise name for the variant)
- description: string (what the variant changes overall)
- domMutations: array of { selector, action, value?, attributeName?, childOrder?, description }
- cssOverrides: string (optional CSS to inject)
- jsSnippet: string (optional JS, use sparingly)
- rationale: string (why these changes should improve the target KPI)`;

const RESULTS_ANALYSIS_SYSTEM_PROMPT = `You are a senior CRO analyst specializing in experiment analysis and statistical interpretation for e-commerce businesses. You translate raw test data into actionable business insights.

## Your Analysis Framework:

### 1. Statistical Rigor
- Evaluate Bayesian probability: >95% is strong evidence, 90-95% is moderate, <90% is weak
- Consider sample size adequacy: at minimum 100 conversions per variant for reliable results
- Assess credible intervals: narrow intervals indicate precision, wide intervals indicate uncertainty
- Flag SRM (Sample Ratio Mismatch) if traffic split deviates >2% from expected
- Note if the test ran long enough to capture full business cycles (weekday/weekend effects)

### 2. Practical Significance
- Statistical significance alone is insufficient — evaluate the magnitude of lift
- Consider the 95% credible interval: if it includes 0%, the result may not be practically meaningful
- Calculate annualized revenue impact: daily_revenue_lift * 365
- Assess whether the lift justifies the ongoing maintenance cost of the change

### 3. Guardrail Analysis
- Check all guardrail metrics for violations
- A winning primary KPI with guardrail violations requires careful evaluation
- Common trade-offs: CVR up but AOV down, or CVR up but refund rate up

### 4. Causal Reasoning
- Hypothesize WHY the variant won or lost based on the changes made
- Connect behavioral signals (if available) to the outcome
- Identify potential confounding factors

### 5. Follow-Up Recommendations
- Win: How to iterate further in the same direction
- Loss: What to test differently to address the same friction
- Inconclusive: What changes would make the next test more decisive

## Output Format:
Return a JSON object with:
- verdict: "winner" | "loser" | "inconclusive"
- winningVariantId: string (if applicable)
- summary: string (one-paragraph stakeholder-friendly summary)
- explanation: string (detailed analysis)
- statisticalNotes: string (statistical confidence assessment)
- keyInsights: string[] (3-5 key takeaways)
- guardrailWarnings: string[] (any guardrail violations or concerns)
- followUpSuggestions: array of { title, description, rationale, predictedKpi, estimatedLift }
- estimatedAnnualImpact: number (estimated annual revenue impact in dollars, positive or negative)`;

const NL_QUERY_SYSTEM_PROMPT = `You are a CRO analytics assistant for an e-commerce optimization platform. You answer natural language questions about store performance, test results, friction signals, and optimization opportunities.

## Capabilities:
- Interpret and analyze GA4 metrics (traffic, conversions, bounce rates, session duration)
- Analyze device-specific performance gaps
- Evaluate traffic source quality and conversion rates
- Identify underperforming pages and funnel steps
- Summarize active test status and results
- Explain friction signals and their business impact
- Compare metrics across time periods, devices, and segments

## Response Guidelines:
- Lead with the direct answer to the question
- Support with specific data points and numbers
- Use plain language — avoid jargon unless the user's question uses it
- When data is insufficient to answer fully, clearly state what's missing
- Suggest related follow-up questions that would provide deeper insight
- Round numbers appropriately (e.g., 12.3%, not 12.31415%)

## Output Format:
Return a JSON object with:
- answer: string (direct, plain-language answer)
- supportingData: array of { metric: string, value: string | number, context?: string }
- suggestedFollowUps: string[] (2-3 relevant follow-up questions)
- confidence: "low" | "medium" | "high"
- limitations: string (optional, if data is incomplete)`;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Analyze friction signals and page data to generate 3-5 structured
 * A/B test hypotheses ranked by projected impact.
 */
export async function generateHypotheses(
  frictionData: FrictionContext
): Promise<Hypothesis[]> {
  const client = getClient();

  const userMessage = buildHypothesisUserMessage(frictionData);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: HYPOTHESIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return extractJson<Hypothesis[]>(text);
}

/**
 * Given a hypothesis and the current page HTML, generate the actual
 * DOM changes (text rewrites, element reorders, style changes) needed
 * for the test variant.
 */
export async function generateTestVariant(
  hypothesis: Hypothesis,
  pageHtml: string,
  brandContext: BrandContext
): Promise<VariantChanges> {
  const client = getClient();

  // Truncate HTML if too long to fit in context
  const truncatedHtml =
    pageHtml.length > 50000
      ? pageHtml.substring(0, 50000) + "\n<!-- [HTML truncated for context length] -->"
      : pageHtml;

  const userMessage = `## Hypothesis to Implement

**Friction Signal:** ${hypothesis.frictionSignal}
**Target Element:** ${hypothesis.targetElement}
**Target Selector:** ${hypothesis.targetSelector ?? "Not specified — determine from HTML"}
**Suggested Change:** ${hypothesis.suggestedChange}
**Predicted KPI:** ${hypothesis.predictedKpi}
**Predicted Lift:** ${(hypothesis.predictedLift * 100).toFixed(1)}%

## Brand Context

- **Store Name:** ${brandContext.storeName}
- **Store URL:** ${brandContext.storeUrl}
- **Industry:** ${brandContext.industry}
- **Brand Voice:** ${brandContext.brandVoice ?? "Not specified — infer from existing copy"}
- **Target Audience:** ${brandContext.targetAudience ?? "General e-commerce shoppers"}
- **AOV:** $${brandContext.averageOrderValue.toFixed(2)}

## Current Page HTML

\`\`\`html
${truncatedHtml}
\`\`\`

Generate the DOM mutations needed to implement this hypothesis as an A/B test variant. Ensure changes are specific, reversible, and respect the brand identity.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: VARIANT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return extractJson<VariantChanges>(text);
}

/**
 * Interpret test results in plain language, explain why the variant
 * won or lost, and suggest follow-up tests.
 */
export async function analyzeTestResults(
  testData: TestResultData
): Promise<ResultAnalysis> {
  const client = getClient();

  const controlVariant = testData.variants.find((v) => v.isControl);
  const treatmentVariants = testData.variants.filter((v) => !v.isControl);

  const userMessage = `## Test Overview

**Test:** ${testData.testName} (${testData.testId})
**Hypothesis:** ${testData.hypothesis}
**Primary KPI:** ${testData.primaryKpi}
**Target URL:** ${testData.targetUrl}
**Duration:** ${testData.runDurationDays} days

## Variant Results

### Control: ${controlVariant?.variantName ?? "Control"}
- Impressions: ${controlVariant?.impressions?.toLocaleString() ?? "N/A"}
- Conversions: ${controlVariant?.conversions?.toLocaleString() ?? "N/A"}
- Conversion Rate: ${controlVariant ? (controlVariant.conversionRate * 100).toFixed(2) : "N/A"}%
- Revenue: $${controlVariant?.revenue?.toLocaleString() ?? "N/A"}
- AOV: $${controlVariant?.aov?.toFixed(2) ?? "N/A"}
${controlVariant?.subscriptionRate != null ? `- Subscription Rate: ${(controlVariant.subscriptionRate * 100).toFixed(2)}%` : ""}

${treatmentVariants
  .map(
    (v) => `### Variant: ${v.variantName}
- Impressions: ${v.impressions.toLocaleString()}
- Conversions: ${v.conversions.toLocaleString()}
- Conversion Rate: ${(v.conversionRate * 100).toFixed(2)}%
- Lift vs Control: ${v.liftPercent != null ? `${v.liftPercent > 0 ? "+" : ""}${(v.liftPercent * 100).toFixed(2)}%` : "N/A"}
- Revenue: $${v.revenue.toLocaleString()}
- AOV: $${v.aov.toFixed(2)}
${v.subscriptionRate != null ? `- Subscription Rate: ${(v.subscriptionRate * 100).toFixed(2)}%` : ""}
- Bayesian Probability of Beating Control: ${v.bayesianProbability != null ? `${(v.bayesianProbability * 100).toFixed(1)}%` : "N/A"}
- 95% Credible Interval: ${v.credibleIntervalLow != null && v.credibleIntervalHigh != null ? `[${(v.credibleIntervalLow * 100).toFixed(2)}%, ${(v.credibleIntervalHigh * 100).toFixed(2)}%]` : "N/A"}`
  )
  .join("\n\n")}

${
  testData.guardrailResults && testData.guardrailResults.length > 0
    ? `## Guardrail Metrics
${testData.guardrailResults
  .map(
    (g) =>
      `- ${g.metric}: threshold=${g.threshold}, actual=${g.actual}, ${g.violated ? "VIOLATED" : "OK"}`
  )
  .join("\n")}`
    : "## Guardrail Metrics\nNo guardrail metrics configured."
}

Provide a thorough analysis of these results. Be specific about statistical confidence, practical significance, and business implications.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: RESULTS_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return extractJson<ResultAnalysis>(text);
}

/**
 * Handle natural language queries about store data, e.g.
 * "What page has the highest mobile drop-off?"
 */
export async function naturalLanguageQuery(
  query: string,
  dataContext: DataContext
): Promise<QueryResponse> {
  const client = getClient();

  const userMessage = `## User Question
"${query}"

## Available Data Context

**Store:** ${dataContext.storeName} (${dataContext.storeId})

${
  dataContext.storeMetrics
    ? `### Store Metrics
- Total Sessions: ${dataContext.storeMetrics.totalSessions.toLocaleString()}
- Total Revenue: $${dataContext.storeMetrics.totalRevenue.toLocaleString()}
- Total Orders: ${dataContext.storeMetrics.totalOrders.toLocaleString()}
- Conversion Rate: ${(dataContext.storeMetrics.conversionRate * 100).toFixed(2)}%
- AOV: $${dataContext.storeMetrics.averageOrderValue.toFixed(2)}
${dataContext.storeMetrics.returningCustomerRate != null ? `- Returning Customer Rate: ${(dataContext.storeMetrics.returningCustomerRate * 100).toFixed(1)}%` : ""}`
    : ""
}

${
  dataContext.recentMetrics && dataContext.recentMetrics.length > 0
    ? `### Page Metrics (Top ${Math.min(dataContext.recentMetrics.length, 20)} pages)
${dataContext.recentMetrics
  .slice(0, 20)
  .map(
    (p) =>
      `- ${p.pagePath}: ${p.pageViews.toLocaleString()} views, ${(p.bounceRate * 100).toFixed(1)}% bounce, ${p.avgSessionDuration.toFixed(0)}s avg duration, ${p.uniqueUsers.toLocaleString()} users`
  )
  .join("\n")}`
    : ""
}

${
  dataContext.deviceBreakdown && dataContext.deviceBreakdown.length > 0
    ? `### Device Breakdown
${dataContext.deviceBreakdown
  .map(
    (d) =>
      `- ${d.deviceCategory}: ${d.sessions.toLocaleString()} sessions, ${(d.conversionRate * 100).toFixed(2)}% CVR, ${(d.bounceRate * 100).toFixed(1)}% bounce`
  )
  .join("\n")}`
    : ""
}

${
  dataContext.trafficSources && dataContext.trafficSources.length > 0
    ? `### Traffic Sources (Top ${Math.min(dataContext.trafficSources.length, 10)})
${dataContext.trafficSources
  .slice(0, 10)
  .map(
    (t) =>
      `- ${t.source}/${t.medium}: ${t.sessions.toLocaleString()} sessions, ${t.conversions.toLocaleString()} conversions, ${(t.bounceRate * 100).toFixed(1)}% bounce`
  )
  .join("\n")}`
    : ""
}

${
  dataContext.funnelData && dataContext.funnelData.length > 0
    ? `### Funnel Data
${dataContext.funnelData
  .map(
    (f) =>
      `- ${f.stepName} (${f.eventName}): ${f.activeUsers.toLocaleString()} users, ${(f.conversionRate * 100).toFixed(1)}% overall CVR, ${(f.dropoffRate * 100).toFixed(1)}% drop-off`
  )
  .join("\n")}`
    : ""
}

${
  dataContext.activeTests && dataContext.activeTests.length > 0
    ? `### Active Tests
${dataContext.activeTests
  .map(
    (t) =>
      `- ${t.name} (${t.status}): KPI=${t.primaryKpi}, URL=${t.targetUrl}`
  )
  .join("\n")}`
    : ""
}

${
  dataContext.recentFrictionSignals && dataContext.recentFrictionSignals.length > 0
    ? `### Recent Friction Signals
${dataContext.recentFrictionSignals
  .slice(0, 10)
  .map(
    (f) =>
      `- ${f.signalType} on ${f.pageUrl}: severity=${f.severity}, metric=${f.metric} (baseline: ${f.baseline})`
  )
  .join("\n")}`
    : ""
}

Answer the user's question using the data above. If the data is insufficient, say so clearly and suggest what additional data would help.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: NL_QUERY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return extractJson<QueryResponse>(text);
}

// ─── Message Builders ───────────────────────────────────────────────────────

function buildHypothesisUserMessage(data: FrictionContext): string {
  const sections: string[] = [];

  sections.push(`## Page Context
- **Page URL:** ${data.pageUrl}
- **Page Type:** ${data.pageType}
- **Store ID:** ${data.storeId}`);

  if (data.funnelData && data.funnelData.length > 0) {
    sections.push(`## Funnel Data
${data.funnelData
  .map(
    (step) =>
      `- ${step.stepName} (${step.eventName}): ${step.activeUsers.toLocaleString()} users, CVR: ${(step.conversionRate * 100).toFixed(1)}%, Drop-off: ${(step.dropoffRate * 100).toFixed(1)}%`
  )
  .join("\n")}`);
  }

  if (data.pageMetrics && data.pageMetrics.length > 0) {
    sections.push(`## Page Metrics
${data.pageMetrics
  .slice(0, 20)
  .map(
    (p) =>
      `- ${p.pagePath}: ${p.pageViews.toLocaleString()} views, ${(p.bounceRate * 100).toFixed(1)}% bounce, ${p.avgSessionDuration.toFixed(0)}s avg duration`
  )
  .join("\n")}`);
  }

  if (data.deviceBreakdown && data.deviceBreakdown.length > 0) {
    sections.push(`## Device Breakdown
${data.deviceBreakdown
  .map(
    (d) =>
      `- ${d.deviceCategory}: ${d.sessions.toLocaleString()} sessions, CVR: ${(d.conversionRate * 100).toFixed(2)}%, Bounce: ${(d.bounceRate * 100).toFixed(1)}%`
  )
  .join("\n")}`);
  }

  if (data.smartEvents && data.smartEvents.length > 0) {
    sections.push(`## Clarity Smart Events (Behavioral Friction)
${data.smartEvents
  .map(
    (e) =>
      `- ${e.eventType} on ${e.pageUrl}${e.selector ? ` (${e.selector})` : ""}: ${e.count} occurrences, ${e.affectedSessions} sessions affected`
  )
  .join("\n")}`);
  }

  if (data.heatmapData) {
    const topClicks = data.heatmapData.clicks
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    sections.push(`## Heatmap Data (${data.heatmapData.pageUrl})
**Total Sessions:** ${data.heatmapData.totalSessions.toLocaleString()}

### Top Click Areas
${topClicks
  .map(
    (c) =>
      `- (${c.x}, ${c.y})${c.selector ? ` [${c.selector}]` : ""}: ${c.count} clicks`
  )
  .join("\n")}

### Scroll Depth
${data.heatmapData.scrollDepth
  .map(
    (s) =>
      `- ${s.depthPercent}%: ${s.usersReached.toLocaleString()} users (${(s.percentageOfTotal * 100).toFixed(1)}%)`
  )
  .join("\n")}`);
  }

  if (data.clarityMetrics) {
    sections.push(`## Clarity Dashboard Metrics
- Sessions: ${data.clarityMetrics.totalSessions.toLocaleString()}
- Bounce Rate: ${(data.clarityMetrics.bounceRate * 100).toFixed(1)}%
- Avg Scroll Depth: ${(data.clarityMetrics.scrollDepthAvg * 100).toFixed(1)}%
- Rage Clicks: ${data.clarityMetrics.rageClicks}
- Dead Clicks: ${data.clarityMetrics.deadClicks}
- Quick Backs: ${data.clarityMetrics.quickBacks}
- Excessive Scrolls: ${data.clarityMetrics.excessiveScrolls}
- Error Clicks: ${data.clarityMetrics.errorClicks}`);
  }

  if (data.searchQueries && data.searchQueries.length > 0) {
    sections.push(`## Search Console Queries (Top 10)
${data.searchQueries
  .slice(0, 10)
  .map(
    (q) =>
      `- "${q.query}": ${q.impressions.toLocaleString()} imp, ${q.clicks.toLocaleString()} clicks, ${(q.ctr * 100).toFixed(1)}% CTR, pos ${q.position.toFixed(1)}`
  )
  .join("\n")}`);
  }

  if (data.trafficSources && data.trafficSources.length > 0) {
    sections.push(`## Traffic Sources
${data.trafficSources
  .slice(0, 10)
  .map(
    (t) =>
      `- ${t.source}/${t.medium}: ${t.sessions.toLocaleString()} sessions, ${t.conversions} conversions, ${(t.bounceRate * 100).toFixed(1)}% bounce`
  )
  .join("\n")}`);
  }

  if (data.userFlowData && data.userFlowData.length > 0) {
    sections.push(`## User Flow (Top 10 paths)
${data.userFlowData
  .slice(0, 10)
  .map(
    (f) =>
      `- ${f.previousPagePath} → ${f.pagePath}: ${f.sessions.toLocaleString()} sessions (${(f.percentage * 100).toFixed(1)}%)`
  )
  .join("\n")}`);
  }

  if (data.pageHtml) {
    const truncated =
      data.pageHtml.length > 10000
        ? data.pageHtml.substring(0, 10000) + "\n<!-- [truncated] -->"
        : data.pageHtml;
    sections.push(`## Page HTML (for element identification)
\`\`\`html
${truncated}
\`\`\``);
  }

  if (data.notes) {
    sections.push(`## Additional Notes
${data.notes}`);
  }

  sections.push(
    "\nAnalyze this data and generate 3-5 test hypotheses. Rank them by projected impact (considering traffic volume, predicted lift, and confidence). Return valid JSON only."
  );

  return sections.join("\n\n");
}
