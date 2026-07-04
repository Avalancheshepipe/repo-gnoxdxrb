// Office-style document icons in the Microsoft 365 visual language (rounded
// tile + letter). Used for document outputs (Word/Excel) on the canvas.

type IconProps = { size?: number; className?: string };

export function WordIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="3" y="5" width="26" height="22" rx="3" fill="#2B579A" />
      <rect x="3" y="5" width="26" height="22" rx="3" fill="url(#wgrad)" fillOpacity="0.25" />
      <path
        d="M8 11.5h2.1l1.4 6 1.5-6h1.9l1.5 6 1.4-6H24l-2.6 9.5h-2.1l-1.5-5.8-1.5 5.8h-2.1L11.6 11.5H8z"
        fill="#fff"
      />
      <defs>
        <linearGradient id="wgrad" x1="3" y1="5" x2="29" y2="27" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ExcelIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <rect x="3" y="5" width="26" height="22" rx="3" fill="#217346" />
      <path
        d="M11 11.5h2.4l2 3.2 2-3.2H20l-3.1 4.6 3.2 4.9h-2.5l-2.1-3.4-2.1 3.4H11l3.2-4.9L11 11.5z"
        fill="#fff"
      />
    </svg>
  );
}

export function DocIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M8 4h10l6 6v18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        fill="#4C7FE0"
      />
      <path d="M18 4l6 6h-6V4z" fill="#2B579A" />
      <rect x="10" y="15" width="10" height="1.6" rx="0.8" fill="#fff" />
      <rect x="10" y="19" width="10" height="1.6" rx="0.8" fill="#fff" />
      <rect x="10" y="23" width="6" height="1.6" rx="0.8" fill="#fff" />
    </svg>
  );
}
