export function Logo({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#1C2630" />
      <circle cx="32" cy="35" r="16.5" fill="none" stroke="#84FF4A" strokeWidth="5" />
      <rect x="29" y="12" width="6" height="8" rx="2" fill="#84FF4A" />
      <path
        d="M32 35 L43 27"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="32" cy="35" r="3.1" fill="#84FF4A" />
    </svg>
  );
}
