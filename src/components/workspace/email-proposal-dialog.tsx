"use client";

import { Mail01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Icon } from "@/components/ui/icon";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Modal } from "@/components/ui/modal";
import type { AgentProposal, ProposalArgsMap } from "@/lib/agent-proposals";

type EmailProposal = Extract<AgentProposal, { kind: "propose_send_email" }>;

type EmailProposalDialogProps = {
  open: boolean;
  proposal: EmailProposal;
  busy: boolean;
  workspaceName: string;
  onClose: () => void;
  onApprove: (args: ProposalArgsMap["propose_send_email"]) => void;
  onDecline: () => void;
};

export function EmailProposalDialog({
  open,
  proposal,
  busy,
  workspaceName,
  onClose,
  onApprove,
  onDecline,
}: EmailProposalDialogProps) {
  const { t } = useI18n();
  const args = proposal.args;

  const [recipient, setRecipient] = useState(args.recipient);
  const [subject, setSubject] = useState(args.subject);
  const [body, setBody] = useState(args.body);
  const [linkUrl, setLinkUrl] = useState(args.linkUrl ?? "");
  const [linkLabel, setLinkLabel] = useState(args.linkLabel ?? "");

  useEffect(() => {
    if (!open) return;
    setRecipient(args.recipient);
    setSubject(args.subject);
    setBody(args.body);
    setLinkUrl(args.linkUrl ?? "");
    setLinkLabel(args.linkLabel ?? "");
  }, [open, args]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("emailProposal.title")}
      description={t("emailProposal.description")}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onPress={onDecline} isDisabled={busy}>
            {t("agentPanel.decline")}
          </Button>
          <Button
            variant="primary"
            isDisabled={busy || !recipient.trim() || !subject.trim() || !body.trim()}
            onPress={() =>
              onApprove({
                recipient: recipient.trim(),
                subject: subject.trim(),
                body: body.trim(),
                linkUrl: linkUrl.trim() || undefined,
                linkLabel: linkLabel.trim() || undefined,
              })
            }
          >
            <Icon icon={Tick02Icon} size={16} />
            {t("emailProposal.send")}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-julow-glass-border bg-accent/5 px-3 py-2 text-sm">
        <Icon icon={Mail01Icon} size={16} className="text-accent" />
        <span className="text-julow-muted">{t("emailProposal.from")}</span>
        <span className="font-medium text-julow-fg">{workspaceName}</span>
      </div>

      <label className="julow-field-label">{t("emailProposal.recipient")}</label>
      <input
        className="julow-input mb-3"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />

      <label className="julow-field-label">{t("emailProposal.subject")}</label>
      <input
        className="julow-input mb-3"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <label className="julow-field-label">{t("emailProposal.body")}</label>
      <MarkdownEditor value={body} onChange={setBody} className="min-h-40" />

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="julow-field-label">{t("emailProposal.linkUrl")}</label>
          <input
            className="julow-input"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://"
          />
        </div>
        <div>
          <label className="julow-field-label">{t("emailProposal.linkLabel")}</label>
          <input
            className="julow-input"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
