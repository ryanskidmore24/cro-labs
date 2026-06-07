import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import TestRow from "@/components/dashboard/TestRow";
import Link from "next/link";
import { Plus, Filter } from "lucide-react";

interface Props {
  searchParams: Promise<{ status?: string; kpi?: string; device?: string }>;
}

export default async function TestsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const statusFilter = params.status;

  const tests = await prisma.test.findMany({
    where: {
      organizationId: session.orgId,
      ...(statusFilter ? { status: statusFilter as any } : {}),
    },
    include: {
      results: { orderBy: { computedAt: "desc" }, take: 1 },
      owner: { select: { name: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  const statuses = ["ALL", "DRAFT", "QUEUED", "RUNNING", "COMPLETED", "SHIPPED", "ARCHIVED"];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your experimentation backlog
          </p>
        </div>
        <Link
          href="/tests/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> New Test
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {statuses.map((s) => {
          const isActive = s === "ALL" ? !statusFilter : statusFilter === s;
          return (
            <Link
              key={s}
              href={s === "ALL" ? "/tests" : `/tests?status=${s}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          );
        })}
      </div>

      {/* Test Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {tests.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="text-left py-3 px-4">Test</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Primary KPI</th>
                <th className="text-left py-3 px-4">Probability</th>
                <th className="text-left py-3 px-4">Revenue Lift</th>
                <th className="text-left py-3 px-4">Duration</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => {
                const r = test.results[0];
                return (
                  <TestRow
                    key={test.id}
                    id={test.id}
                    name={test.name}
                    status={test.status as any}
                    primaryKpi={test.primaryKpi}
                    probability={r?.bayesianProbability ?? undefined}
                    revenueLift={r?.liftPercent ?? undefined}
                    startedAt={test.startedAt?.toISOString() ?? null}
                    targetUrl={test.targetUrl ?? undefined}
                  />
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-3">
              {statusFilter
                ? `No ${statusFilter.toLowerCase()} tests`
                : "No tests yet"}
            </p>
            <Link
              href="/tests/new"
              className="text-sm text-blue-600 hover:underline"
            >
              Create your first test
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
