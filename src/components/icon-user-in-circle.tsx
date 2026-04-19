/** Profile: head + shoulders inside an outer ring (sidebar + bottom nav). */

type Props = { className?: string; strokeWidth?: number };

export function IconUserInCircle({ className, strokeWidth = 1.5 }: Props) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <circle cx="12" cy="8.75" r="2.35" strokeLinecap="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.35 17.1c.9-2.35 2.9-3.6 5.65-3.6s4.75 1.25 5.65 3.6"
      />
    </svg>
  );
}
