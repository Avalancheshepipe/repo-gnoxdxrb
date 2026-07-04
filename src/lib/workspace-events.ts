/** Open the right-rail agent panel (expands if collapsed). */
export function openAgentPanel() {
  window.dispatchEvent(new CustomEvent("julow:open-agents"));
}

/** Select an agent in the agent chat picker and focus the composer. */
export function openAgentChat(agentId: string) {
  openAgentPanel();
  window.dispatchEvent(
    new CustomEvent("julow:select-agent", { detail: { agentId } }),
  );
  window.dispatchEvent(new CustomEvent("julow:focus-agent-composer"));
}
