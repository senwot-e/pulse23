export default function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`inline-block align-middle ${className}`}
      aria-label="Verified"
    >
      <circle cx="8" cy="8" r="8" fill="#2563EB" />
      <path
        d="M5 8.5L7 10.5L11 6"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
