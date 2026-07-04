"use client";

import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/trpc";

export function AcceptInvite({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const preview = api.workspace.invitePreview.useQuery({ invitationId });
  const utils = api.useUtils();
  const accept = api.workspace.acceptInvite.useMutation({
    onSuccess: async (data) => {
      await utils.workspace.list.invalidate();
      router.push(`/app?org=${data.organizationId}`);
      router.refresh();
    },
  });

  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    if (autoTried.current) return;
    const data = preview.data;
    if (!data || data.status !== "pending" || data.expired) return;
    autoTried.current = true;
    accept.mutate(
      { invitationId },
      { onError: (e) => setError(e.message) },
    );
  }, [preview.data, invitationId]);

  if (preview.isLoading || (accept.isPending && !error)) {
    return (
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center text-sm text-julow-muted">
        Joining workspace…
      </div>
    );
  }

  const data = preview.data;
  const invalid =
    !data || data.status !== "pending" || data.expired;

  if (invalid) {
    return (
      <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Invitation unavailable
        </h1>
        <p className="mt-2 text-sm text-julow-muted">
          This invite link is invalid, already used, or expired. Ask your
          teammate to send a new one.
        </p>
        <Button
          variant="primary"
          className="mt-6"
          onPress={() => router.push("/app")}
        >
          Go to your workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent/10">
        <Icon icon={UserGroupIcon} size={24} className="text-accent" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        Join {data.workspaceName}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-julow-muted">
        {data.invitedBy} invited you to collaborate as{" "}
        <span className="font-medium text-julow-fg">{data.role}</span>.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          isDisabled={accept.isPending}
          onPress={() => {
            setError(null);
            accept.mutate(
              { invitationId },
              {
                onError: (e) => setError(e.message),
              },
            );
          }}
        >
          {accept.isPending ? "Joining…" : `Join ${data.workspaceName}`}
        </Button>
        <Button variant="ghost" onPress={() => router.push("/app")}>
          Not now
        </Button>
      </div>
    </div>
  );
}
