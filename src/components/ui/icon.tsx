import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

type IconProps = {
  icon: IconSvgElement;
  size?: number;
  className?: string;
  strokeWidth?: number;
  color?: string;
};

export function Icon({
  icon,
  size = 20,
  className,
  strokeWidth = 1.75,
  color = "currentColor",
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden
    />
  );
}

/** Filled plus — avoids stroke overlap artifacts on thin icons. */
export function PlusIcon({
  size = 14,
  color = "currentColor",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="11" y="6" width="2" height="12" rx="1" fill={color} />
      <rect x="6" y="11" width="12" height="2" rx="1" fill={color} />
    </svg>
  );
}
