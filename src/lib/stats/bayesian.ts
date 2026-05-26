import type {
  BayesianResult,
  RevenueTestResult,
  TimeEstimate,
  GuardrailCheck,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MC_SAMPLES = 10_000;
const CREDIBLE_LEVEL = 0.95;
const CREDIBLE_TAIL = (1 - CREDIBLE_LEVEL) / 2; // 0.025

// ---------------------------------------------------------------------------
// Pseudo-random number generator (seeded for reproducibility in tests)
// ---------------------------------------------------------------------------

/** Mulberry32 — fast 32-bit PRNG. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Beta distribution sampling via Joehnk's method (no external deps)
// ---------------------------------------------------------------------------

/** Sample from Gamma(alpha, 1) using Marsaglia & Tsang's method. */
function gammaSample(alpha: number, rng: () => number): number {
  if (alpha < 1) {
    // Boost: Gamma(alpha) = Gamma(alpha+1) * U^(1/alpha)
    return gammaSample(alpha + 1, rng) * Math.pow(rng(), 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normalSample(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Sample from Normal(0,1) using Box-Muller. */
function normalSample(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Sample from Beta(alpha, beta). */
function betaSample(alpha: number, beta: number, rng: () => number): number {
  const x = gammaSample(alpha, rng);
  const y = gammaSample(beta, rng);
  return x / (x + y);
}

// ---------------------------------------------------------------------------
// Helper: quantile from sorted samples
// ---------------------------------------------------------------------------

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

// ---------------------------------------------------------------------------
// Beta distribution CDF & inverse (for credible intervals without MC)
// ---------------------------------------------------------------------------

/** Regularised incomplete beta function via continued fraction (Lentz). */
function betaIncomplete(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lnBeta =
    lgamma(a) + lgamma(b) - lgamma(a + b);
  const front =
    Math.exp(
      Math.log(x) * a + Math.log(1 - x) * b - lnBeta
    ) / a;

  // Lentz's continued fraction
  let f = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= 200; m++) {
    // even step
    let numerator =
      (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= c * d;

    // odd step
    numerator =
      -(((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return front * f;
}

/** Log-gamma via Lanczos approximation. */
function lgamma(x: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
    );
  }
  x -= 1;
  let a = coef[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += coef[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bayesian analysis for a binary (conversion rate) A/B test.
 *
 * Uses a Beta-Binomial model with a Beta(1,1) uniform prior.
 * Monte Carlo simulation with 10,000 samples.
 */
export function calculateBayesianProbability(
  controlConversions: number,
  controlTrials: number,
  variantConversions: number,
  variantTrials: number,
  priorAlpha = 1,
  priorBeta = 1,
): BayesianResult {
  // Posterior parameters: Beta(alpha + conversions, beta + failures)
  const controlAlpha = priorAlpha + controlConversions;
  const controlBetaParam = priorBeta + (controlTrials - controlConversions);
  const variantAlpha = priorAlpha + variantConversions;
  const variantBetaParam = priorBeta + (variantTrials - variantConversions);

  const rng = mulberry32(42); // deterministic seed

  const variantSamples: number[] = new Array(MC_SAMPLES);
  const controlSamples: number[] = new Array(MC_SAMPLES);
  const liftSamples: number[] = new Array(MC_SAMPLES);
  let wins = 0;

  for (let i = 0; i < MC_SAMPLES; i++) {
    const cSample = betaSample(controlAlpha, controlBetaParam, rng);
    const vSample = betaSample(variantAlpha, variantBetaParam, rng);
    controlSamples[i] = cSample;
    variantSamples[i] = vSample;
    liftSamples[i] = cSample > 0 ? (vSample - cSample) / cSample : 0;
    if (vSample > cSample) wins++;
  }

  // Sort for quantile computation
  variantSamples.sort((a, b) => a - b);
  liftSamples.sort((a, b) => a - b);

  const controlRate = controlAlpha / (controlAlpha + controlBetaParam);
  const variantRate = variantAlpha / (variantAlpha + variantBetaParam);

  return {
    probabilityOfBeatingControl: wins / MC_SAMPLES,
    credibleInterval: [
      quantile(variantSamples, CREDIBLE_TAIL),
      quantile(variantSamples, 1 - CREDIBLE_TAIL),
    ],
    expectedLift:
      controlRate > 0 ? (variantRate - controlRate) / controlRate : 0,
    liftCI: [
      quantile(liftSamples, CREDIBLE_TAIL),
      quantile(liftSamples, 1 - CREDIBLE_TAIL),
    ],
    variantRate,
    controlRate,
  };
}

/**
 * Bayesian analysis for a revenue (continuous) A/B test.
 *
 * Models per-visitor revenue as log-normal. For visitors with zero revenue
 * we add a small epsilon to enable log-transform. Uses Normal-Inverse-Gamma
 * conjugate posterior approximated via Monte Carlo.
 */
export function calculateRevenueTest(
  controlRevenues: number[],
  variantRevenues: number[],
): RevenueTestResult {
  if (controlRevenues.length === 0 || variantRevenues.length === 0) {
    return {
      probabilityVariantWins: 0.5,
      expectedRevenueLift: 0,
      liftCI: [0, 0],
      variantMean: mean(variantRevenues),
      controlMean: mean(controlRevenues),
    };
  }

  const epsilon = 0.01;
  const logControl = controlRevenues.map((r) => Math.log(Math.max(r, epsilon)));
  const logVariant = variantRevenues.map((r) => Math.log(Math.max(r, epsilon)));

  const controlMu = mean(logControl);
  const variantMu = mean(logVariant);
  const controlVar = variance(logControl);
  const variantVar = variance(logVariant);
  const nC = logControl.length;
  const nV = logVariant.length;

  // Standard error of the mean in log-space
  const controlSE = Math.sqrt(controlVar / nC);
  const variantSE = Math.sqrt(variantVar / nV);

  const rng = mulberry32(42);
  let wins = 0;
  const liftSamples: number[] = new Array(MC_SAMPLES);

  for (let i = 0; i < MC_SAMPLES; i++) {
    // Sample posterior mean in log-space (Normal approximation)
    const cLogMean = controlMu + controlSE * normalSample(rng);
    const vLogMean = variantMu + variantSE * normalSample(rng);

    // Convert to original scale (expected value of log-normal = exp(mu + sigma^2/2))
    const cMean = Math.exp(cLogMean + controlVar / 2);
    const vMean = Math.exp(vLogMean + variantVar / 2);

    if (vMean > cMean) wins++;
    liftSamples[i] = cMean > 0 ? (vMean - cMean) / cMean : 0;
  }

  liftSamples.sort((a, b) => a - b);

  const cMean = mean(controlRevenues);
  const vMean = mean(variantRevenues);

  return {
    probabilityVariantWins: wins / MC_SAMPLES,
    expectedRevenueLift: cMean > 0 ? (vMean - cMean) / cMean : 0,
    liftCI: [
      quantile(liftSamples, CREDIBLE_TAIL),
      quantile(liftSamples, 1 - CREDIBLE_TAIL),
    ],
    variantMean: vMean,
    controlMean: cMean,
  };
}

/**
 * Estimate calendar days until the test reaches a target probability threshold.
 *
 * Uses the current observed effect size and daily traffic to project forward
 * via a simplified power-like heuristic for Bayesian tests.
 */
export function estimateTimeToSignificance(
  currentData: {
    controlConversions: number;
    controlTrials: number;
    variantConversions: number;
    variantTrials: number;
    daysRunning: number;
  },
  targetProbability = 0.95,
  dailyTraffic?: number,
): TimeEstimate {
  const {
    controlConversions,
    controlTrials,
    variantConversions,
    variantTrials,
    daysRunning,
  } = currentData;

  const currentResult = calculateBayesianProbability(
    controlConversions,
    controlTrials,
    variantConversions,
    variantTrials,
  );

  const currentProb = currentResult.probabilityOfBeatingControl;

  // Already significant
  if (currentProb >= targetProbability) {
    return {
      estimatedDays: 0,
      estimatedDate: new Date(),
      currentProbability: currentProb,
    };
  }

  // Estimate daily traffic from existing data if not provided
  const totalTrials = controlTrials + variantTrials;
  const effectiveDailyTraffic =
    dailyTraffic ?? (daysRunning > 0 ? totalTrials / daysRunning : 100);

  // Observed conversion rates
  const pC = controlTrials > 0 ? controlConversions / controlTrials : 0;
  const pV = variantTrials > 0 ? variantConversions / variantTrials : 0;
  const pooledRate = (pC + pV) / 2 || 0.05;
  const effectSize = Math.abs(pV - pC);

  if (effectSize < 1e-6) {
    // No detectable effect — return a large estimate
    return {
      estimatedDays: 365,
      estimatedDate: new Date(Date.now() + 365 * 86400000),
      currentProbability: currentProb,
    };
  }

  // Required samples per variant (frequentist approximation as proxy):
  // n ~ 16 * p*(1-p) / delta^2  (for ~95% power at alpha=0.05)
  const requiredPerVariant =
    (16 * pooledRate * (1 - pooledRate)) / (effectSize * effectSize);
  const totalRequired = requiredPerVariant * 2;
  const remaining = Math.max(0, totalRequired - totalTrials);
  const estimatedDays = Math.ceil(remaining / effectiveDailyTraffic);

  const estimatedDate = new Date(Date.now() + estimatedDays * 86400000);

  return {
    estimatedDays,
    estimatedDate,
    currentProbability: currentProb,
  };
}

/**
 * Check guardrail metrics for a test.
 *
 * Compares the variant's observed metric against the configured threshold.
 */
export function checkGuardrails(
  guardrails: Array<{
    metric: string;
    threshold: number;
    operator: string;
    customName?: string | null;
  }>,
  controlMetrics: Record<string, number>,
  variantMetrics: Record<string, number>,
): GuardrailCheck[] {
  return guardrails.map((g) => {
    const metricKey = g.customName || g.metric;
    const controlValue = controlMetrics[metricKey] ?? 0;
    const variantValue = variantMetrics[metricKey] ?? 0;

    // The guardrail checks whether the variant has degraded relative to threshold.
    // The threshold is typically expressed as max acceptable degradation.
    // E.g. "AOV must not drop by more than 5%" -> operator LTE, threshold 0.05
    // We compare the relative change from control.
    const relativeChange =
      controlValue !== 0
        ? (variantValue - controlValue) / Math.abs(controlValue)
        : 0;

    let violated = false;
    switch (g.operator) {
      case 'GT':
        violated = relativeChange > g.threshold;
        break;
      case 'LT':
        violated = relativeChange < -g.threshold;
        break;
      case 'GTE':
        violated = relativeChange >= g.threshold;
        break;
      case 'LTE':
        violated = relativeChange <= -g.threshold;
        break;
    }

    return {
      metric: metricKey,
      threshold: g.threshold,
      operator: g.operator,
      currentValue: relativeChange,
      violated,
    };
  });
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    sum += d * d;
  }
  return sum / (arr.length - 1); // Bessel's correction
}
