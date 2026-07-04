"use client";

import {
  Copy01Icon,
  Mail01Icon,
  Tick02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Button, Chip } from "@heroui/react";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select-field";
import { api } from "@/lib/trpc";

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string | null;
  workspaceName: string;
};

function inviteLink(id: string): string {
  if (typeof window === "undefined") return `/invite/${id}`;
  return `${window.location.origin}/invite/${id}`;
}

export function ShareDialog({
  open,
  onClose,
  organizationId,
  workspaceName,
}: ShareDialogProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const enabled = open && Boolean(organizationId);
  const utils = api.useUtils();

  const membersQuery = api.workspace.members.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled },
  );
  const invitesQuery = api.workspace.invitations.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled },
  );

  const invite = api.workspace.invite.useMutation({
    onSuccess: async () => {
      setEmail("");
      setError(null);
      if (organizationId)
        await utils.workspace.invitations.invalidate({ organizationId });
    },
    onError: (e) => setError(e.message),
  });
  const revoke = api.workspace.revokeInvite.useMutation({
    onSettled: async () => {
      if (organizationId)
        await utils.workspace.invitations.invalidate({ organizationId });
    },
  });

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t("common.share")} · ${workspaceName}`}
      description={t("share.description")}
      width="max-w-lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!organizationId || !email.trim()) return;
          invite.mutate({ organizationId, email: email.trim(), role });
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-julow-muted">
            <Icon icon={Mail01Icon} size={16} />
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("share.emailPlaceholder")}
            className="julow-input julow-input--with-icon"
          />
        </div>
        <SelectField
          value={role}
          onChange={(v) => setRole(v as "member" | "admin")}
          ariaLabel="Role"
          className="sm:w-36"
          options={[
            { value: "member", label: t("share.roleMember") },
            { value: "admin", label: t("share.roleAdmin") },
          ]}
        />
        <Button
          type="submit"
          variant="primary"
          isDisabled={invite.isPending || !email.trim()}
        >
          {invite.isPending ? t("share.inviting") : t("share.invite")}
        </Button>
      </form>

      {error && (
        <p className="mt-2 text-sm text-danger">{error}</p>
      )}

      {/* Pending invitations */}
      {(invitesQuery.data?.length ?? 0) > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-julow-muted">
            {t("share.pending")}
          </p>
          <ul className="space-y-1.5">
            {invitesQuery.data?.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-2 rounded-xl border border-julow-glass-border px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{inv.email}</span>
                <Chip size="sm" variant="soft">
                  {inv.role}
                </Chip>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => copy(inv.id)}
                  aria-label="Copy invite link"
                >
                  <Icon
                    icon={copiedId === inv.id ? Tick02Icon : Copy01Icon}
                    size={14}
                  />
                  {copiedId === inv.id ? t("share.copied") : t("share.link")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  isDisabled={revoke.isPending}
                  onPress={() =>
                    organizationId &&
                    revoke.mutate({ organizationId, invitationId: inv.id })
                  }
                >
                  {t("share.revoke")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Current members */}
      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-julow-muted">
          <Icon icon={UserGroupIcon} size={13} />
          {t("share.members")} ({membersQuery.data?.length ?? 0})
        </p>
        <ul className="space-y-1.5">
          {membersQuery.data?.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-xl px-1 py-1 text-sm"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-medium text-accent">
                {(m.user.name ?? m.user.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {m.user.name ?? m.user.email}
              </span>
              <Chip size="sm" variant="soft" color={m.role === "owner" ? "accent" : "default"}>
                {m.role}
              </Chip>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
