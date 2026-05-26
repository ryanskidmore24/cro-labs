export {
  calculateBayesianProbability,
  calculateRevenueTest,
  estimateTimeToSignificance,
  checkGuardrails,
} from './bayesian';

export type {
  BayesianResult,
  RevenueTestResult,
  TimeEstimate,
  GuardrailCheck,
  VariantResultSummary,
  TestResultSummary,
  AutoPromotionDecision,
  AutoPromotionConfig,
} from './types';

import { prisma } from '@/lib/prisma';
import {
  calculateBayesianProbability,
  calculateRevenueTest,
  estimateTimeToSignificance,
  checkGuardrails,
} from './bayesian';
import type {
  TestResultSummary,
  VariantResultSummary,
  AutoPromotionConfig,
  AutoPromotionDecision,
} from './types';

// ---------------------------------------------------------------------------
// computeTestResults — pulls data from DB, runs Bayesian analysis
// ---------------------------------------------------------------------------

export async function computeTestResults(
  testId: string,
): Promise<TestResultSummary> {
  const test = await prisma.test.findUniqueOrThrow({
    where: { id: testId },
    include: {
      variants: true,
      guardrailMetrics: true,
      events: true,
    },
  });

  // Aggregate events per variant
  const variantAggregates = new Map<
    string,
    {
      impressions: number;
      conversions: number;
      revenues: number[];
      totalRevenue: number;
      metricBuckets: Record<string, number[]>;
    }
  >();

  for (const variant of test.variants) {
    variantAggregates.set(variant.id, {
      impressions: 0,
      conversions: 0,
      revenues: [],
      totalRevenue: 0,
      metricBuckets: {},
    });
  }

  for (const event of test.events) {
    const agg = variantAggregates.get(event.variantId);
    if (!agg) continue;

    switch (event.eventType) {
      case 'IMPRESSION':
        agg.impressions++;
        break;
      case 'CONVERSION':
        agg.conversions++;
        if (event.revenue != null) {
          agg.revenues.push(event.revenue);
          agg.totalRevenue += event.revenue;
        }
        break;
    }

    // Collect guardrail metric data from event metadata
    if (event.eventData && typeof event.eventData === 'object') {
      const data = event.eventData as Record<string, unknown>;
      for (const [key, val] of Object.entries(data)) {
        if (typeof val === 'number') {
          if (!agg.metricBuckets[key]) agg.metricBuckets[key] = [];
          agg.metricBuckets[key].push(val);
        }
      }
    }
  }

  // Find the control variant
  const controlVariant = test.variants.find((v) => v.isControl);
  if (!controlVariant) {
    throw new Error(`Test ${testId} has no control variant`);
  }

  const controlAgg = variantAggregates.get(controlVariant.id)!;

  // Build per-variant results
  const variantResults: VariantResultSummary[] = test.variants.map((variant) => {
    const agg = variantAggregates.get(variant.id)!;
    const conversionRate =
      agg.impressions > 0 ? agg.conversions / agg.impressions : 0;
    const revenuePerVisitor =
      agg.impressions > 0 ? agg.totalRevenue / agg.impressions : 0;

    let bayesian = null;
    let revenueBayesian = null;

    if (!variant.isControl && controlAgg.impressions > 0 && agg.impressions > 0) {
      bayesian = calculateBayesianProbability(
        controlAgg.conversions,
        controlAgg.impressions,
        agg.conversions,
        agg.impressions,
      );

      if (controlAgg.revenues.length > 0 && agg.revenues.length > 0) {
        revenueBayesian = calculateRevenueTest(
          controlAgg.revenues,
          agg.revenues,
        );
      }
    }

    return {
      variantId: variant.id,
      variantName: variant.name,
      isControl: variant.isControl,
      impressions: agg.impressions,
      conversions: agg.conversions,
      conversionRate,
      revenue: agg.totalRevenue,
      revenuePerVisitor,
      bayesian,
      revenueBayesian,
    };
  });

  // Check guardrails
  const controlMetrics: Record<string, number> = {};
  const variantMetrics: Record<string, number> = {};

  // Compute average metric values for control
  for (const [key, vals] of Object.entries(controlAgg.metricBuckets)) {
    controlMetrics[key] =
      vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }
  // Add standard metrics
  controlMetrics['AOV'] =
    controlAgg.conversions > 0
      ? controlAgg.totalRevenue / controlAgg.conversions
      : 0;

  // For guardrails, use the first non-control variant (or aggregate all non-control)
  const firstVariant = test.variants.find((v) => !v.isControl);
  if (firstVariant) {
    const fvAgg = variantAggregates.get(firstVariant.id)!;
    for (const [key, vals] of Object.entries(fvAgg.metricBuckets)) {
      variantMetrics[key] =
        vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    }
    variantMetrics['AOV'] =
      fvAgg.conversions > 0
        ? fvAgg.totalRevenue / fvAgg.conversions
        : 0;
  }

  const guardrails = checkGuardrails(
    test.guardrailMetrics.map((g) => ({
      metric: g.metric,
      threshold: g.threshold,
      operator: g.operator,
      customName: g.customName,
    })),
    controlMetrics,
    variantMetrics,
  );

  // Time estimate for the primary variant
  const primaryVariant = variantResults.find((v) => !v.isControl);
  let timeEstimate = null;
  if (primaryVariant && !primaryVariant.isControl) {
    const daysRunning = test.startedAt
      ? Math.max(
          1,
          (Date.now() - test.startedAt.getTime()) / 86400000,
        )
      : 1;

    timeEstimate = estimateTimeToSignificance({
      controlConversions: controlAgg.conversions,
      controlTrials: controlAgg.impressions,
      variantConversions: primaryVariant.conversions,
      variantTrials: primaryVariant.impressions,
      daysRunning,
    });
  }

  return {
    testId: test.id,
    testName: test.name,
    status: test.status,
    primaryKpi: test.primaryKpi,
    variants: variantResults,
    guardrails,
    timeEstimate,
  };
}

// ---------------------------------------------------------------------------
// shouldAutoPromote — checks if test meets auto-promotion criteria
// ---------------------------------------------------------------------------

export async function shouldAutoPromote(
  testId: string,
  config: AutoPromotionConfig = {},
): Promise<AutoPromotionDecision> {
  const {
    probabilityThreshold = 0.95,
    minSampleSize = 1000,
    minRunDays = 7,
  } = config;

  const results = await computeTestResults(testId);

  // Check minimum run duration
  const test = await prisma.test.findUniqueOrThrow({
    where: { id: testId },
    select: { startedAt: true, status: true },
  });

  if (test.status !== 'RUNNING') {
    return { promote: false, reason: 'Test is not currently running.' };
  }

  if (!test.startedAt) {
    return { promote: false, reason: 'Test has no start date recorded.' };
  }

  const daysRunning = (Date.now() - test.startedAt.getTime()) / 86400000;
  if (daysRunning < minRunDays) {
    return {
      promote: false,
      reason: `Test has only run ${Math.floor(daysRunning)} days; minimum is ${minRunDays}.`,
    };
  }

  // Check minimum sample size
  const totalImpressions = results.variants.reduce(
    (sum, v) => sum + v.impressions,
    0,
  );
  if (totalImpressions < minSampleSize) {
    return {
      promote: false,
      reason: `Total sample size (${totalImpressions}) below minimum (${minSampleSize}).`,
    };
  }

  // Check guardrail violations
  const violations = results.guardrails.filter((g) => g.violated);
  if (violations.length > 0) {
    const violatedNames = violations.map((v) => v.metric).join(', ');
    return {
      promote: false,
      reason: `Guardrail violations detected: ${violatedNames}.`,
    };
  }

  // Check probability threshold for the best variant
  const bestVariant = results.variants
    .filter((v) => !v.isControl && v.bayesian)
    .sort(
      (a, b) =>
        (b.bayesian?.probabilityOfBeatingControl ?? 0) -
        (a.bayesian?.probabilityOfBeatingControl ?? 0),
    )[0];

  if (!bestVariant || !bestVariant.bayesian) {
    return {
      promote: false,
      reason: 'No variant has sufficient data for Bayesian analysis.',
    };
  }

  if (
    bestVariant.bayesian.probabilityOfBeatingControl < probabilityThreshold
  ) {
    return {
      promote: false,
      reason: `Best variant probability (${(bestVariant.bayesian.probabilityOfBeatingControl * 100).toFixed(1)}%) below threshold (${(probabilityThreshold * 100).toFixed(1)}%).`,
    };
  }

  return {
    promote: true,
    reason: `Variant "${bestVariant.variantName}" has ${(bestVariant.bayesian.probabilityOfBeatingControl * 100).toFixed(1)}% probability of beating control with ${totalImpressions} total impressions over ${Math.floor(daysRunning)} days. No guardrail violations.`,
  };
}
