// Tag/handle helpers shared by client + server. A person's tag is derived from
// the start of their email login; an agent's tag from the first word of its name.

export function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "user";
}

export function handleFromAgentName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.replace(/[^a-zA-Z0-9]/g, "") || "agent";
}

export type Mentionable = {
  kind: "agent" | "user";
  name: string;
  handle: string;
  sub: string;
};
