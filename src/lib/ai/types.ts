import type { EffortEstimate, HypothesisStatus, AiModel, PrimaryKpi, Severity, SignalType } from "@prisma/client";
import type {
  FunnelStepResult,
  PageMetric,
  UserFlowPath,
  TrafficSource,
  DeviceMetric,
  ConversionEvent,
  SearchQueryRow,
  PagePerformanceRow,
  HeatmapData,
  SmartEvent,
  DashboardMetrics,
} from "@/lib/integrations";

// ─── Date Range ─────────────────────────────────────────────────────────────

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

// ─── Brand / Store Context ──────────────────────────────────────────────────

export interface BrandContext {
  storeName: string;
  storeUrl: string;
  industry: string;
  targetAudience?: string;
  brandVoice?: string;
  averageOrderValue: number;
  monthlyTraffic?: number;
  primaryProducts?: string[];
  competitorUrls?: string[];
}

// ─── Friction Detection ─────────────────────────────────────────────────────

export interface FrictionContext {
  storeId: string;
  pageUrl: string;
  pageType: "homepage" | "collection" | "product" | "cart" | "checkout" | "landing" | "other";
  /** GA4 funnel data showing drop-off between steps */
  funnelData?: FunnelStepResult[];
  /** Per-page metrics from GA4 */
  pageMetrics?: PageMetric[];
  /** User navigation flow between pages */
  userFlowData?: UserFlowPath[];
  /** Traffic source breakdown */
  trafficSources?: TrafficSource[];
  /** Device category metrics */
  deviceBreakdown?: DeviceMetric[];
  /** Clarity heatmap and scroll data */
  heatmapData?: HeatmapData;
  /** Clarity smart events (rage clicks, dead clicks, etc.) */
  smartEvents?: SmartEvent[];
  /** Clarity dashboard overview */
  clarityMetrics?: DashboardMetrics;
  /** Search Console query data */
  searchQueries?: SearchQueryRow[];
  /** Search Console page performance */
  searchPagePerformance?: PagePerformanceRow[];
  /** Current page HTML (truncated if needed) */
  pageHtml?: string;
  /** Additional context or notes */
  notes?: string;
}

export interface FrictionSignalDetected {
  id: string;
  pageUrl: string;
  signalType: SignalType;
  severity: Severity;
  metric: number;
  baseline: number;
  description: string;
  evidencePoints: string[];
  metadata?: Record<string, unknown>;
}

// ─── Hypothesis ─────────────────────────────────────────────────────────────

export interface Hypothesis {
  id?: string;
  testId?: string;
  /** The friction signal or problem this hypothesis addresses */
  frictionSignal: string;
  /** What element/area to change */
  targetElement: string;
  /** CSS selector for the target element */
  targetSelector?: string;
  /** The specific change to make */
  suggestedChange: string;
  /** Which KPI this is expected to improve */
  predictedKpi: PrimaryKpi | string;
  /** Predicted lift percentage (e.g. 0.05 = 5%) */
  predictedLift: number;
  /** AI confidence in this hypothesis (0-1) */
  confidenceScore: number;
  /** Implementation effort */
  effort: EffortEstimate;
  /** The AI model that generated this */
  aiModel: AiModel;
  /** Supporting evidence and reasoning */
  evidenceData?: {
    reasoning: string;
    supportingDataPoints: string[];
    caveats: string[];
    relatedPatterns?: string[];
  };
  status: HypothesisStatus;
}

// ─── Variant / DOM Changes ──────────────────────────────────────────────────

export type DomMutationAction =
  | "replaceText"
  | "replaceHtml"
  | "setAttribute"
  | "removeAttribute"
  | "addClass"
  | "removeClass"
  | "setStyle"
  | "reorderChildren"
  | "insertBefore"
  | "insertAfter"
  | "remove"
  | "wrap";

export interface DomMutation {
  /** CSS selector targeting the element */
  selector: string;
  /** The type of DOM change */
  action: DomMutationAction;
  /** The value to apply (new text, HTML, attribute value, style, etc.) */
  value?: string;
  /** For setAttribute: the attribute name */
  attributeName?: string;
  /** For reorderChildren: the new order of child indices */
  childOrder?: number[];
  /** Human-readable description of what this mutation does */
  description: string;
}

export interface VariantChanges {
  /** Human-readable name for the variant */
  variantName: string;
  /** Description of overall changes */
  description: string;
  /** Array of DOM mutations to apply */
  domMutations: DomMutation[];
  /** Optional CSS to inject */
  cssOverrides?: string;
  /** Optional JS to execute */
  jsSnippet?: string;
  /** Explanation of why these changes should improve the target KPI */
  rationale: string;
}

// ─── Test Results Analysis ──────────────────────────────────────────────────

export interface TestResultData {
  testId: string;
  testName: string;
  hypothesis: string;
  primaryKpi: PrimaryKpi;
  targetUrl: string;
  runDurationDays: number;
  variants: TestResultVariant[];
  guardrailResults?: GuardrailResult[];
}

export interface TestResultVariant {
  variantId: string;
  variantName: string;
  isControl: boolean;
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  aov: number;
  subscriptionRate?: number;
  bayesianProbability?: number;
  credibleIntervalLow?: number;
  credibleIntervalHigh?: number;
  liftPercent?: number;
}

export interface GuardrailResult {
  metric: string;
  threshold: number;
  actual: number;
  violated: boolean;
}

export interface ResultAnalysis {
  /** One-line verdict: winner, loser, or inconclusive */
  verdict: "winner" | "loser" | "inconclusive";
  /** Winning variant ID (if applicable) */
  winningVariantId?: string;
  /** Plain-language summary suitable for a stakeholder */
  summary: string;
  /** Detailed explanation of why the variant won or lost */
  explanation: string;
  /** Statistical confidence assessment */
  statisticalNotes: string;
  /** Key insights extracted from the data */
  keyInsights: string[];
  /** Guardrail violation warnings */
  guardrailWarnings: string[];
  /** Suggested follow-up tests */
  followUpSuggestions: FollowUpSuggestion[];
  /** Estimated annualized revenue impact if shipped */
  estimatedAnnualImpact?: number;
}

export interface FollowUpSuggestion {
  title: string;
  description: string;
  rationale: string;
  predictedKpi: string;
  estimatedLift: number;
}

// ─── GA4 Analysis (Gemini) ──────────────────────────────────────────────────

export interface GA4AnalysisInput {
  funnelData?: FunnelStepResult[];
  pageMetrics?: PageMetric[];
  userFlowData?: UserFlowPath[];
  trafficSources?: TrafficSource[];
  deviceBreakdown?: DeviceMetric[];
  conversionEvents?: ConversionEvent[];
  dateRange: DateRange;
  storeName?: string;
}

export interface DataInsights {
  /** Top-level summary of findings */
  summary: string;
  /** Identified patterns in the data */
  patterns: DataPattern[];
  /** Detected anomalies */
  anomalies: DataAnomaly[];
  /** Funnel drop-off analysis */
  funnelAnalysis?: FunnelAnalysis;
  /** Device-specific findings */
  deviceInsights?: DeviceInsight[];
  /** Traffic source quality assessment */
  trafficQuality?: TrafficQualityInsight[];
}

export interface DataPattern {
  name: string;
  description: string;
  significance: "low" | "medium" | "high";
  affectedMetric: string;
  dataPoints: string[];
}

export interface DataAnomaly {
  metric: string;
  expected: number;
  actual: number;
  deviationPercent: number;
  possibleCauses: string[];
  severity: "low" | "medium" | "high";
}

export interface FunnelAnalysis {
  overallConversionRate: number;
  biggestDropoffStep: string;
  dropoffRate: number;
  estimatedLostRevenue: number;
  recommendations: string[];
}

export interface DeviceInsight {
  device: string;
  finding: string;
  severity: "low" | "medium" | "high";
  recommendation: string;
}

export interface TrafficQualityInsight {
  source: string;
  medium: string;
  quality: "high" | "medium" | "low";
  reason: string;
  conversionRate: number;
  bounceRate: number;
}

// ─── Search Console Analysis (Gemini) ───────────────────────────────────────

export interface SearchConsoleInput {
  searchQueries: SearchQueryRow[];
  pagePerformance: PagePerformanceRow[];
  dateRange: DateRange;
  storeName?: string;
  storeUrl?: string;
}

export interface SearchInsights {
  summary: string;
  /** Keywords with high impressions but low CTR (opportunity) */
  keywordOpportunities: KeywordOpportunity[];
  /** Content gaps: queries you should rank for but don't */
  contentGaps: ContentGap[];
  /** Pages that could improve with better SEO */
  underperformingPages: UnderperformingPage[];
  /** Quick-win keywords (position 8-20 range) */
  quickWins: QuickWin[];
}

export interface KeywordOpportunity {
  query: string;
  impressions: number;
  currentCtr: number;
  currentPosition: number;
  estimatedClicksGained: number;
  recommendation: string;
}

export interface ContentGap {
  topicArea: string;
  relatedQueries: string[];
  estimatedMonthlySearches: number;
  recommendation: string;
}

export interface UnderperformingPage {
  pageUrl: string;
  impressions: number;
  ctr: number;
  avgPosition: number;
  issues: string[];
  recommendations: string[];
}

export interface QuickWin {
  query: string;
  currentPosition: number;
  impressions: number;
  estimatedAdditionalClicks: number;
  recommendation: string;
}

// ─── Clarity / Behavior Analysis (Gemini) ───────────────────────────────────

export interface ClarityInput {
  heatmapData?: HeatmapData[];
  smartEvents?: SmartEvent[];
  dashboardMetrics?: DashboardMetrics;
  dateRange: DateRange;
  storeName?: string;
}

export interface BehaviorInsights {
  summary: string;
  /** UX friction points detected from behavior data */
  frictionPoints: BehaviorFrictionPoint[];
  /** Scroll depth analysis findings */
  scrollAnalysis?: ScrollAnalysis;
  /** Click pattern analysis */
  clickPatterns?: ClickPattern[];
  /** Session behavior patterns */
  sessionPatterns?: SessionPattern[];
}

export interface BehaviorFrictionPoint {
  pageUrl: string;
  type: "rage_click" | "dead_click" | "excessive_scroll" | "quick_back" | "error_click" | "low_scroll_depth" | "high_bounce";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedSessions: number;
  selector?: string;
  recommendation: string;
}

export interface ScrollAnalysis {
  averageDepth: number;
  contentBelowFold: string;
  recommendation: string;
}

export interface ClickPattern {
  description: string;
  significance: "low" | "medium" | "high";
  recommendation: string;
}

export interface SessionPattern {
  pattern: string;
  frequency: number;
  insight: string;
}

// ─── Cross-Platform Analysis (Gemini) ───────────────────────────────────────

export interface CrossPlatformInput {
  ga4Data?: GA4AnalysisInput;
  searchConsoleData?: SearchConsoleInput;
  clarityData?: ClarityInput;
  storeMetrics?: StoreMetrics;
  dateRange: DateRange;
}

export interface StoreMetrics {
  storeId: string;
  totalSessions: number;
  totalRevenue: number;
  totalOrders: number;
  conversionRate: number;
  averageOrderValue: number;
  returningCustomerRate?: number;
}

export interface UnifiedInsights {
  /** Executive summary combining all data sources */
  executiveSummary: string;
  /** Corroborated findings (confirmed by multiple data sources) */
  corroboratedFindings: CorroboratedFinding[];
  /** Priority actions ranked by projected impact */
  prioritizedActions: PrioritizedAction[];
  /** Revenue opportunity breakdown */
  revenueOpportunities: RevenueOpportunity[];
  /** Overall health score (0-100) */
  storeHealthScore: number;
  /** Category scores */
  categoryScores: {
    trafficQuality: number;
    userExperience: number;
    conversionEfficiency: number;
    searchVisibility: number;
  };
}

export interface CorroboratedFinding {
  finding: string;
  dataSources: string[];
  confidence: "medium" | "high" | "very_high";
  impact: "low" | "medium" | "high";
  details: string;
}

export interface PrioritizedAction {
  rank: number;
  action: string;
  rationale: string;
  estimatedImpact: string;
  effort: EffortEstimate;
  dataSources: string[];
}

export interface RevenueOpportunity {
  area: string;
  description: string;
  estimatedMonthlyRevenue: number;
  confidence: "low" | "medium" | "high";
  requiredActions: string[];
}

// ─── Natural Language Query ─────────────────────────────────────────────────

export interface DataContext {
  storeId: string;
  storeName: string;
  /** Recent GA4 metrics */
  recentMetrics?: PageMetric[];
  /** Device breakdown */
  deviceBreakdown?: DeviceMetric[];
  /** Traffic sources */
  trafficSources?: TrafficSource[];
  /** Funnel data */
  funnelData?: FunnelStepResult[];
  /** Active tests */
  activeTests?: Array<{
    id: string;
    name: string;
    status: string;
    primaryKpi: string;
    targetUrl: string;
  }>;
  /** Recent friction signals */
  recentFrictionSignals?: FrictionSignalDetected[];
  /** Store metrics */
  storeMetrics?: StoreMetrics;
}

export interface QueryResponse {
  /** Direct answer to the query */
  answer: string;
  /** Supporting data points */
  supportingData: Array<{
    metric: string;
    value: string | number;
    context?: string;
  }>;
  /** Related follow-up questions the user might want to ask */
  suggestedFollowUps: string[];
  /** Confidence in the answer */
  confidence: "low" | "medium" | "high";
  /** If the query couldn't be fully answered, explain why */
  limitations?: string;
}

// ─── Test Suggestion ────────────────────────────────────────────────────────

export interface TestSuggestion {
  /** Title of the suggested test */
  title: string;
  /** Detailed description */
  description: string;
  /** The friction signal this addresses */
  frictionSignalId: string;
  /** Which page to test on */
  targetUrl: string;
  /** Page type */
  pageType: string;
  /** The hypothesis behind this test */
  hypothesis: Hypothesis;
  /** Projected sessions per month hitting this page */
  projectedSessions: number;
  /** Current baseline conversion rate */
  baselineCvr: number;
  /** Estimated lift from this change */
  estimatedLift: number;
  /** Store's average order value */
  aov: number;
  /**
   * Projected monthly revenue lift:
   * projectedSessions * baselineCvr * estimatedLift * aov
   */
  projectedRevenueLift: number;
  /** Implementation effort */
  effort: EffortEstimate;
  /** Priority score (higher = do first) combining impact and effort */
  priorityScore: number;
}

// ─── CRO Engine Orchestration ───────────────────────────────────────────────

export interface FullAnalysisResult {
  storeId: string;
  analyzedAt: string;
  /** Gemini data insights */
  dataInsights: DataInsights;
  /** Gemini search insights */
  searchInsights?: SearchInsights;
  /** Gemini behavior insights */
  behaviorInsights?: BehaviorInsights;
  /** Unified cross-platform insights */
  unifiedInsights: UnifiedInsights;
  /** Detected friction signals */
  frictionSignals: FrictionSignalDetected[];
  /** Claude-generated hypotheses */
  hypotheses: Hypothesis[];
  /** Ranked test suggestions with revenue projections */
  testSuggestions: TestSuggestion[];
}
