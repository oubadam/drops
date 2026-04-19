/** Narrow the rail — rounded frame + double chevron left. */
export function IconSidebarCollapseMark({ className }: { className?: string }) {
  return (
    <svg className={`pointer-events-none ${className ?? ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <rect x="4.25" y="4.75" width="15.5" height="14.5" rx="2.25" fill="none" />
      <path strokeLinecap="round" strokeLinejoin="round" fill="none" d="M15.25 8.25 10.75 12l4.5 3.75M11.5 8.25 7 12l4.5 3.75" />
    </svg>
  );
}

/** Widen the rail — same frame + double chevron right. */
export function IconSidebarExpandMark({ className }: { className?: string }) {
  return (
    <svg className={`pointer-events-none ${className ?? ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65}>
      <rect x="4.25" y="4.75" width="15.5" height="14.5" rx="2.25" fill="none" />
      <path strokeLinecap="round" strokeLinejoin="round" fill="none" d="M8.75 8.25 13.25 12l-4.5 3.75M12.5 8.25 17 12l-4.5 3.75" />
    </svg>
  );
}
