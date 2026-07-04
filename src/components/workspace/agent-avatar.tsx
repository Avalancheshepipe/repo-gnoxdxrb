"use client";

import {
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent,
} from "react";

type AgentOrbSize = "sm" | "md" | "lg";

function hashSeed(seed: string) {
  let a = 0;
  let b = 0;
  let c = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    a = (a + ch * (i + 1)) | 0;
    b = (b + ch * (i + 3)) | 0;
    c = (c + ch * (i + 7)) | 0;
  }
  return {
    a: Math.abs(a),
    b: Math.abs(b),
    c: Math.abs(c),
  };
}

function buildOrbPalette(seed: string) {
  const { a, b, c } = hashSeed(seed);
  const hue = a % 360;
  const hue2 = (hue + 22 + (b % 36)) % 360;

  const hx = 22 + (b % 24);
  const hy = 16 + (c % 20);
  const wx = 44 + (a % 28);
  const wy = 52 + (b % 24);
  const gx = 68 + (c % 24);
  const gy = 74 + (a % 20);

  const mx1 = 26 + (b % 44);
  const my1 = 18 + (c % 38);
  const mx2 = 58 + (a % 32);
  const my2 = 62 + (b % 30);
  const mx3 = 78 + (c % 18);
  const my3 = 34 + (a % 28);

  const baseL = 0.56 + (b % 7) / 100;
  const deepL = baseL - 0.06;
  const waveL = baseL + 0.06;
  const glowL = baseL + 0.12;
  const highlightL = 0.84 + (a % 4) / 100;

  const baseC = 0.1 + (c % 5) / 100;
  const deepC = baseC + 0.02;
  const waveC = 0.08 + (a % 4) / 100;
  const glowC = 0.07 + (b % 3) / 100;
  const highlightC = 0.025 + (c % 2) / 100;

  const base = `oklch(${baseL} ${baseC} ${hue})`;
  const deep = `oklch(${deepL} ${deepC} ${hue})`;
  const wave = `oklch(${waveL} ${waveC} ${hue2})`;
  const glow = `oklch(${glowL} ${glowC} ${hue2})`;
  const highlight = `oklch(${highlightL} ${highlightC} ${hue})`;

  const surface = [
    `radial-gradient(circle at ${hx}% ${hy}%, color-mix(in oklch, ${highlight} 42%, transparent) 0%, transparent 58%)`,
    `radial-gradient(circle at ${gx}% ${gy}%, color-mix(in oklch, ${glow} 38%, transparent) 0%, transparent 56%)`,
    `radial-gradient(ellipse 140% 105% at ${wx}% ${wy}%, color-mix(in oklch, ${wave} 32%, transparent) 0%, transparent 68%)`,
    `radial-gradient(circle at 50% 112%, ${deep} 0%, ${base} 80%)`,
    `radial-gradient(circle at 50% 50%, ${base} 0%, ${deep} 100%)`,
  ].join(", ");

  const mesh = [
    `radial-gradient(at ${mx1}% ${my1}%, color-mix(in oklch, ${wave} 16%, transparent) 0px, transparent 52%)`,
    `radial-gradient(at ${mx2}% ${my2}%, color-mix(in oklch, ${glow} 14%, transparent) 0px, transparent 50%)`,
    `radial-gradient(at ${mx3}% ${my3}%, color-mix(in oklch, ${highlight} 10%, transparent) 0px, transparent 48%)`,
    `radial-gradient(at ${50 + (b % 20)}% ${50 + (c % 20)}%, color-mix(in oklch, ${base} 20%, transparent) 0px, transparent 55%)`,
  ].join(", ");

  return { surface, mesh, base };
}

function orbMotionLimits(size: AgentOrbSize) {
  if (size === "lg") return { shift: 4, tilt: 9, glare: 16 };
  if (size === "md") return { shift: 3.5, tilt: 8, glare: 14 };
  return { shift: 3, tilt: 7, glare: 12 };
}

function useOrbPointer(size: AgentOrbSize = "sm") {
  const ref = useRef<HTMLSpanElement>(null);
  const limits = orbMotionLimits(size);

  const onMove = useCallback(
    (e: MouseEvent<HTMLSpanElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      const mx = nx * limits.shift * 2;
      const my = ny * limits.shift * 2;

      el.style.setProperty("--orb-shift-x", `${mx}px`);
      el.style.setProperty("--orb-shift-y", `${my}px`);
      el.style.setProperty("--orb-tilt-x", `${-ny * limits.tilt}deg`);
      el.style.setProperty("--orb-tilt-y", `${nx * limits.tilt}deg`);
      el.style.setProperty("--orb-glare-x", `${50 + nx * limits.glare}%`);
      el.style.setProperty("--orb-glare-y", `${38 + ny * limits.glare}%`);
    },
    [limits.glare, limits.shift, limits.tilt],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--orb-shift-x", "0px");
    el.style.setProperty("--orb-shift-y", "0px");
    el.style.setProperty("--orb-tilt-x", "0deg");
    el.style.setProperty("--orb-tilt-y", "0deg");
    el.style.setProperty("--orb-glare-x", "50%");
    el.style.setProperty("--orb-glare-y", "38%");
  }, []);

  return { ref, onMove, onLeave };
}

type AgentOrbAvatarProps = {
  seed: string;
  size?: AgentOrbSize;
  className?: string;
};

export function AgentOrbAvatar({
  seed,
  size = "sm",
  className = "",
}: AgentOrbAvatarProps) {
  const palette = useMemo(() => buildOrbPalette(seed), [seed]);
  const { ref, onMove, onLeave } = useOrbPointer(size);

  return (
    <span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`julow-agent-orb julow-agent-orb--${size} ${className}`.trim()}
      style={{ "--orb-base": palette.base } as CSSProperties}
      aria-hidden
    >
      <span className="julow-agent-orb__inner" aria-hidden>
        <span
          className="julow-agent-orb__surface"
          style={{ background: palette.surface }}
          aria-hidden
        />
        <span
          className="julow-agent-orb__mesh"
          style={{ background: palette.mesh }}
          aria-hidden
        />
        <span className="julow-agent-orb__glare" aria-hidden />
        <span className="julow-agent-orb__noise" aria-hidden />
      </span>
    </span>
  );
}

type AgentOverflowAvatarProps = {
  count: number;
  size?: AgentOrbSize;
  className?: string;
};

export function AgentOverflowAvatar({
  count,
  size = "sm",
  className = "",
}: AgentOverflowAvatarProps) {
  const { ref, onMove, onLeave } = useOrbPointer(size);

  return (
    <span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`julow-agent-orb julow-agent-orb--overflow julow-agent-orb--${size} ${className}`.trim()}
      style={{ "--orb-base": "oklch(0.38 0.01 286)" } as CSSProperties}
    >
      <span className="julow-agent-orb__inner" aria-hidden>
        <span className="julow-agent-orb__surface" aria-hidden />
        <span className="julow-agent-orb__mesh" aria-hidden />
        <span className="julow-agent-orb__glare julow-agent-orb__glare--muted" aria-hidden />
        <span className="julow-agent-orb__noise" aria-hidden />
      </span>
      <span className="julow-agent-orb__label">+{count}</span>
    </span>
  );
}

export type { AgentOrbSize };

export type AgentAvatarStatusTone =
  | "online"
  | "busy"
  | "idle"
  | "offline"
  | "live";

const statusToneClass: Record<AgentAvatarStatusTone, string> = {
  online: "julow-avatar-status--online",
  busy: "julow-avatar-status--busy",
  idle: "julow-avatar-status--idle",
  offline: "julow-avatar-status--offline",
  live: "julow-avatar-status--live",
};

export function AgentAvatarStatus({
  size = "sm",
  tone,
}: {
  size?: AgentOrbSize;
  tone: AgentAvatarStatusTone;
}) {
  return (
    <span
      className={`julow-avatar-status julow-avatar-status--${size} ${statusToneClass[tone]}`}
      aria-hidden
    />
  );
}

export function AgentOrbWithStatus({
  seed,
  size = "sm",
  status,
  className = "",
}: {
  seed: string;
  size?: AgentOrbSize;
  status?: AgentAvatarStatusTone;
  className?: string;
}) {
  return (
    <span className={`julow-avatar-wrap ${className}`.trim()}>
      <AgentOrbAvatar seed={seed} size={size} />
      {status && <AgentAvatarStatus size={size} tone={status} />}
    </span>
  );
}
