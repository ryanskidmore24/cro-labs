import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/shared/DashboardLayout";
import SnippetInstallPanel from "@/components/settings/SnippetInstallPanel";

export default async function SnippetSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true, publicKey: true },
  });

  if (!org) redirect("/login");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <DashboardLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Snippet Installation</h1>
        <p className="text-sm text-gray-500 mb-6">
          Add this snippet to every page of your site to enable A/B testing and event tracking.
        </p>
        <SnippetInstallPanel orgName={org.name} publicKey={org.publicKey} appUrl={appUrl} />
      </div>
    </DashboardLayout>
  );
}
