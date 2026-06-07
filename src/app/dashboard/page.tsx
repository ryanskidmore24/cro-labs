import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import StatsCard from "@/components/dashboard/StatsCard";
import TestRow from "@/components/dashboard/TestRow";
import InsightCard from "@/components/dashboard/InsightCard";
import Link from "next/link";
import {
  FlaskConical,
  TrendingUp,
  Plus,
  Brain,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = session.orgId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [activeTests, frictionSignals, totalTests, completedCount, recentConversions] =
    await Promise.all([
      prisma.test.findMany({
        where: { organizationId: orgId, status: "RUNNING" },
        include: {
          results: { orderBy: { computedAt: "desc" }, take: 1 },
          owner: { select: { name: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
      prisma.frictionSignal.findMany({
        where: { organizationId: orgId, resolvedAt: null },
        orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
        take: 5,
      }),
      prisma.test.count({ where: { organizationId: orgId } }),
      prisma.test.count({
        where: { organizationId: orgId, status: { in: ["COMPLETED", "SHIPPED"] } },
      }),
      prisma.testEvent.count({
        where: {
          eventType: "CONVERSION",
          createdAt: { gte: thirtyDaysAgo },
          test: { organizationId: orgId },
        },
      }),
    ]);

  const avgDuration =
    activeTests.length > 0
      ? activeTests.reduce((sum, t) => {
          const start = t.startedAt ?? t.createdAt;
          return sum + (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / activeTests.length
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Overview of your experimentation program
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/tests/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New Test
          </Link>
          <Link
            href="/insights"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Brain size={16} /> Run Analysis
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Active Tests"
          value={activeTests.length.toString()}
          icon="flask"
          subtitle={`${totalTests} total`}
        />
        <StatsCard
          title="Conversions (30d)"
          value={recentConversions.toLocaleString()}
          icon="trending"
          subtitle="From test traffic"
        />
        <StatsCard
          title="Completed"
          value={completedCount.toString()}
          icon="check"
          subtitle="Tests shipped or analyzed"
        />
        <StatsCard
          title="Avg Duration"
          value={avgDuration > 0 ? `${avgDuration.toFixed(0)}d` : "—"}
          icon="clock"
          subtitle="Active tests"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <FlaskConical size={18} /> Active Tests
            </h2>
            <Link href="/tests?status=RUNNING" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {activeTests.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left py-2 px-4">Test</th>
                  <th className="text-left py-2 px-4">Status</th>
                  <th className="text-left py-2 px-4">KPI</th>
                  <th className="text-left py-2 px-4">Prob.</th>
                  <th className="text-left py-2 px-4">Lift</th>
                  <th className="text-left py-2 px-4">Days</th>
                  <th className="py-2 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {activeTests.map((test) => {
                  const latestResult = test.results[0];
                  return (
                    <TestRow
                      key={test.id}
                      id={test.id}
                      name={test.name}
                      status={test.status as any}
                      primaryKpi={test.primaryKpi}
                      probability={latestResult?.bayesianProbability ?? undefined}
                      revenueLift={latestResult?.liftPercent ?? undefined}
                      startedAt={test.startedAt?.toISOString() ?? null}
                      targetUrl={test.targetUrl ?? undefined}
                    />
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <FlaskConical size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-3">No active tests yet</p>
              <Link href="/tests/new" className="text-sm text-blue-600 hover:underline">
                Create your first test
              </Link>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp size={18} /> AI Insights
            </h2>
            <Link href="/insights" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {frictionSignals.length > 0 ? (
              frictionSignals.map((signal) => (
                <InsightCard
                  key={signal.id}
                  id={signal.id}
                  pageUrl={signal.pageUrl}
                  signalType={signal.signalType}
                  severity={signal.severity}
                  metric={signal.metric}
                  baseline={signal.baseline}
                  detectedAt={signal.detectedAt.toISOString()}
                />
              ))
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <Brain size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-3">No friction signals detected yet</p>
                <p className="text-xs text-gray-400">
                  Connect integrations and run an analysis to get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
