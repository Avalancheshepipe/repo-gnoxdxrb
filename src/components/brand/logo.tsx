import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  showWordmark?: boolean;
  size?: number;
  wordmarkClassName?: string;
  /** Omit or pass null to render without navigation (e.g. inside the workspace shell). */
  href?: string | null;
  className?: string;
};

function wordmarkClassForSize(size: number, override?: string) {
  if (override) return override;
  if (size >= 52) return "text-3xl font-semibold leading-none tracking-tight";
  if (size >= 48) return "text-2xl font-semibold tracking-tight";
  if (size >= 36) return "text-lg font-semibold tracking-tight";
  return "text-sm font-semibold tracking-tight";
}

export function Logo({
  showWordmark = true,
  size = 28,
  wordmarkClassName,
  href = "/",
  className = "",
}: LogoProps) {
  const wordmarkClass = wordmarkClassForSize(size, wordmarkClassName);
  const iconRadius = size >= 48 ? "rounded-xl" : "rounded-lg";

  const content = (
    <>
      <Image
        src="/logo.png"
        alt="Julow"
        width={size}
        height={size}
        className={`shrink-0 object-contain ${iconRadius}`}
        style={{ width: size, height: size }}
        priority
      />
      {showWordmark && (
        <span className={`truncate ${wordmarkClass}`}>Julow</span>
      )}
    </>
  );

  const rootClassName = `flex min-w-0 items-center gap-2 ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={rootClassName}>
        {content}
      </Link>
    );
  }

  return <div className={rootClassName}>{content}</div>;
}
