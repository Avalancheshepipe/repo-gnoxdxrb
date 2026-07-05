"use client";

import { Button } from "@heroui/react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/trpc";

type AgentSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string | null;
};

/**
 * Per-workspace auto-approval settings for the agent: each action type can run
 * automatically (AUTO) or wait for the user (APPROVE). Backed by the same
 * ApprovalRule rows the approvals dialog manages.
 */
export function AgentSettingsDialog({
  open,
  onClose,
  organizationId,
}: AgentSettingsDialogProps) {
  const { t } = useI18n();
  const orgId = organizationId ?? "";
  const utils = api.useUtils();

  const rulesQuery = api.approval.rules.list.useQuery(
    { organizationId: orgId },
    { enabled: open && Boolean(organizationId) },
  );
  const setRule = api.approval.rules.set.useMutation({
    onSettled: async () => {
      await utils.approval.rules.invalidate();
    },
  });

  const rules = rulesQuery.data ?? [];
  const allAuto = rules.length > 0 && rules.every((r) => r.level === "AUTO");

  const setAll = (level: "AUTO" | "APPROVE") => {
    for (const rule of rules) {
      if (rule.level !== level) {
        setRule.mutate({
          organizationId: orgId,
          actionType: rule.actionType,
          level,
        });
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("agentSettings.title")}
      width="max-w-md"
    >
      <p className="text-xs text-julow-muted">{t("agentSettings.hint")}</p>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-julow-glass-border bg-julow-glass-bg px-3 py-2.5">
        <span className="text-sm font-medium">{t("agentSettings.allowAll")}</span>
        <Button
          size="sm"
          variant={allAuto ? "primary" : "outline"}
          isDisabled={setRule.isPending || rules.length === 0}
          onPress={() => setAll(allAuto ? "APPROVE" : "AUTO")}
        >
          {allAuto ? t("agentSettings.auto") : t("agentSettings.ask")}
        </Button>
      </div>

      <div className="mt-3 space-y-1.5">
        {rules.map((rule) => (
          <div
            key={rule.actionType}
            className="flex items-center justify-between gap-2 rounded-xl border border-julow-glass-border px-3 py-2"
          >
            <span className="min-w-0 truncate text-sm">
              {t(`approvals.action.${rule.actionType}`)}
            </span>
            <div className="flex shrink-0 gap-1">
              {(["AUTO", "APPROVE"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={setRule.isPending || rule.level === "BLOCKED"}
                  onClick={() =>
                    setRule.mutate({
                      organizationId: orgId,
                      actionType: rule.actionType,
                      level,
                    })
                  }
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    rule.level === level
                      ? "bg-accent/15 text-accent"
                      : "text-julow-muted hover:bg-julow-glass-bg hover:text-julow-fg"
                  }`}
                >
                  {level === "AUTO"
                    ? t("agentSettings.auto")
                    : t("agentSettings.ask")}
                </button>
              ))}
              {rule.level === "BLOCKED" && (
                <span className="rounded-lg bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
                  {t("approvals.level.BLOCKED")}
                </span>
              )}
            </div>
          </div>
        ))}
        {rulesQuery.isLoading && (
          <p className="py-4 text-center text-sm text-julow-muted">…</p>
        )}
      </div>
    </Modal>
  );
}
