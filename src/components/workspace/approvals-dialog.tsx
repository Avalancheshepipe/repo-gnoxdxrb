"use client";

import { Button, Chip } from "@heroui/react";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/trpc";

type ApprovalsDialogProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string | null;
};

type Tab = "pending" | "history" | "rules";

const LEVELS = ["AUTO", "APPROVE", "BLOCKED"] as const;

const STATUS_COLOR: Record<string, "default" | "success" | "danger" | "warning"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "default",
};

function summarizeAction(actionData: unknown): string {
  if (!actionData || typeof actionData !== "object") return "";
  const data = actionData as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof data.title === "string") parts.push(data.title);
  if (typeof data.taskId === "string") parts.push(`task ${data.taskId}`);
  if (typeof data.format === "string") parts.push(String(data.format));
  return parts.join(" · ").slice(0, 120);
}

export function ApprovalsDialog({
  open,
  onClose,
  organizationId,
}: ApprovalsDialogProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("pending");
  const enabled = open && Boolean(organizationId);
  const orgId = organizationId ?? "";
  const utils = api.useUtils();

  const pendingQuery = api.approval.requests.list.useQuery(
    { organizationId: orgId, status: "PENDING" },
    { enabled },
  );
  const historyQuery = api.approval.requests.list.useQuery(
    { organizationId: orgId },
    { enabled: enabled && tab === "history" },
  );
  const rulesQuery = api.approval.rules.list.useQuery(
    { organizationId: orgId },
    { enabled: enabled && tab === "rules" },
  );

  const invalidate = async () => {
    await utils.approval.requests.invalidate();
  };
  const approve = api.approval.requests.approve.useMutation({
    onSettled: invalidate,
  });
  const reject = api.approval.requests.reject.useMutation({
    onSettled: invalidate,
  });
  const batchApprove = api.approval.requests.batchApprove.useMutation({
    onSettled: invalidate,
  });
  const setRule = api.approval.rules.set.useMutation({
    onSettled: async () => {
      await utils.approval.rules.invalidate();
    },
  });

  const pending = pendingQuery.data ?? [];
  const busy =
    approve.isPending || reject.isPending || batchApprove.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("approvals.title")}
      width="max-w-2xl"
    >
      <div className="mb-3 flex gap-1">
        {(["pending", "history", "rules"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === key
                ? "bg-accent/15 text-accent"
                : "text-julow-muted hover:bg-julow-glass-bg hover:text-julow-fg"
            }`}
          >
            {t(`approvals.${key}Tab`)}
            {key === "pending" && pending.length > 0 ? ` (${pending.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "rules" ? (
        <div className="space-y-2">
          <p className="text-xs text-julow-muted">{t("approvals.rulesHint")}</p>
          {(rulesQuery.data ?? []).map((rule) => (
            <div
              key={rule.actionType}
              className="flex items-center justify-between gap-2 rounded-xl border border-julow-glass-border px-3 py-2"
            >
              <span className="text-sm">
                {t(`approvals.action.${rule.actionType}`)}
              </span>
              <div className="flex gap-1">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    disabled={setRule.isPending}
                    onClick={() =>
                      setRule.mutate({
                        organizationId: orgId,
                        actionType: rule.actionType,
                        level,
                      })
                    }
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                      rule.level === level
                        ? "bg-accent/15 text-accent"
                        : "text-julow-muted hover:bg-julow-glass-bg hover:text-julow-fg"
                    }`}
                  >
                    {t(`approvals.level.${level}`)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tab === "pending" && pending.length > 1 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                isDisabled={busy}
                onPress={() =>
                  batchApprove.mutate({
                    organizationId: orgId,
                    requestIds: pending.map((r) => r.id),
                  })
                }
              >
                {t("approvals.approveAll")}
              </Button>
            </div>
          )}
          {((tab === "pending" ? pending : historyQuery.data) ?? []).map(
            (request) => (
              <div
                key={request.id}
                className="rounded-xl border border-julow-glass-border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t(`approvals.action.${request.actionType}`)}
                    </p>
                    <p className="truncate text-xs text-julow-muted">
                      {t("approvals.requestedBy")}{" "}
                      {request.agent?.name ?? request.requestedBy}
                      {summarizeAction(request.actionData)
                        ? ` · ${summarizeAction(request.actionData)}`
                        : ""}
                    </p>
                  </div>
                  {request.status === "PENDING" ? (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        isDisabled={busy}
                        onPress={() =>
                          approve.mutate({
                            organizationId: orgId,
                            requestId: request.id,
                          })
                        }
                      >
                        {t("approvals.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        isDisabled={busy}
                        onPress={() =>
                          reject.mutate({
                            organizationId: orgId,
                            requestId: request.id,
                          })
                        }
                      >
                        {t("approvals.reject")}
                      </Button>
                    </div>
                  ) : (
                    <Chip
                      size="sm"
                      color={STATUS_COLOR[request.status] ?? "default"}
                    >
                      {t(`approvals.status.${request.status}`)}
                    </Chip>
                  )}
                </div>
              </div>
            ),
          )}
          {(tab === "pending" ? pending : historyQuery.data ?? []).length ===
            0 && (
            <p className="py-6 text-center text-sm text-julow-muted">
              {t("approvals.empty")}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
