export function Logo({ size = 88 }: { size?: number }) {
  return (
    <div className="logo" style={{ width: size, height: size, borderRadius: size / 4 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </div>
  );
}
