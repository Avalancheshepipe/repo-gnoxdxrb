import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { AcceptInvite } from "@/components/auth/accept-invite";
import { Icon } from "@/components/ui/icon";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/sign-in?redirect=${encodeURIComponent(`/invite/${id}`)}`);
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="px-6 py-5">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm text-julow-muted transition-colors hover:text-julow-fg"
        >
          <Icon icon={ArrowLeft01Icon} size={16} />
          Go to workspace
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <AcceptInvite invitationId={id} />
      </main>
    </div>
  );
}
