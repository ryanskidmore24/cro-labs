/** Result of a Bayesian A/B test comparison (binary metric). */
export interface BayesianResult {
  /** Probability that the variant beats the control (0-1). */
  probabilityOfBeatingControl: number;
  /** 95% credible interval for variant conversion rate. */
  credibleInterval: [low: number, high: number];
  /** Expected relative lift vs control (e.g. 0.12 = +12%). */
  expectedLift: number;
  /** 95% credible interval for the relative lift. */
  liftCI: [low: number, high: number];
  /** Variant posterior mean conversion rate. */
  variantRate: number;
  /** Control posterior mean conversion rate. */
  controlRate: number;
}

/** Result of a Bayesian revenue (continuous metric) test. */
export interface RevenueTestResult {
  /** Probability that variant mean revenue > control mean revenue. */
  probabilityVariantWins: number;
  /** Expected relative lift in revenue per visitor. */
  expectedRevenueLift: number;
  /** 95% credible interval for the revenue lift. */
  liftCI: [low: number, high: number];
  /** Variant mean revenue per visitor. */
  variantMean: number;
  /** Control mean revenue per visitor. */
  controlMean: number;
}

/** Estimate of time remaining to reach statistical significance. */
export interface TimeEstimate {
  /** Estimated calendar days remaining. */
  estimatedDays: number;
  /** Projected date of significance. */
  estimatedDate: Date;
  /** Current probability of beating control. */
  currentProbability: number;
}

/** Result of a guardrail check for a single metric. */
export interface GuardrailCheck {
  /** Guardrail metric identifier (e.g. AOV, PAGE_LOAD). */
  metric: string;
  /** Threshold value configured for this guardrail. */
  threshold: number;
  /** Operator used for comparison (GT, LT, GTE, LTE). */
  operator: string;
  /** Current observed value for this metric. */
  currentValue: number;
  /** Whether the guardrail has been violated. */
  violated: boolean;
}

/** Per-variant summary with Bayesian analysis results. */
export interface VariantResultSummary {
  variantId: string;
  variantName: string;
  isControl: boolean;
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  revenuePerVisitor: number;
  bayesian: BayesianResult | null;
  revenueBayesian: RevenueTestResult | null;
}

/** Full results summary for a test. */
export interface TestResultSummary {
  testId: string;
  testName: string;
  status: string;
  primaryKpi: string;
  variants: VariantResultSummary[];
  guardrails: GuardrailCheck[];
  timeEstimate: TimeEstimate | null;
}

/** Auto-promotion decision. */
export interface AutoPromotionDecision {
  promote: boolean;
  reason: string;
}

/** Configuration for auto-promotion criteria. */
export interface AutoPromotionConfig {
  /** Minimum probability of beating control (default 0.95). */
  probabilityThreshold?: number;
  /** Minimum total sample size across all variants (default 1000). */
  minSampleSize?: number;
  /** Minimum days the test must run (default 7). */
  minRunDays?: number;
}
