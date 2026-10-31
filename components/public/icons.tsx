/** Pictogrammes au trait du portail (décoratifs : le texte voisin porte le sens). */
type IconProps = { className?: string };

function Svg({ className = "size-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {children}
    </svg>
  );
}

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
);

export const TrophyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
    <path d="M7.5 6H4.5v1.5A3 3 0 0 0 7.7 10.5M16.5 6h3v1.5a3 3 0 0 1-3.2 3M12 13.5V17M8.5 20h7M9.5 17h5v3h-5z" />
  </Svg>
);

export const BallIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m12 8 3.3 2.4-1.3 3.9h-4l-1.3-3.9zM12 3.5V8M15.3 10.4l4.4-1.4M14 14.3l2.6 3.8M10 14.3l-2.6 3.8M8.7 10.4 4.3 9" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z" />
  </Svg>
);

export const WomanIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="5" r="2.2" />
    <path d="M9.5 9h5l2 7h-9zM10.5 16v5M13.5 16v5" />
  </Svg>
);

export const GroupIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <circle cx="16.5" cy="9" r="2.4" />
    <path d="M15.5 14.2a4.6 4.6 0 0 1 5 5.3" />
  </Svg>
);

export const ArrowIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Svg>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.3 4.6-4.8" />
  </Svg>
);

export const SwapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5v14M12 5v14M16 5v14" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Svg>
);

export const ResetIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </Svg>
);

export const ChevronIcon = ({ dir = "right", ...p }: IconProps & { dir?: "left" | "right" }) => (
  <Svg {...p}>
    <path d={dir === "left" ? "m14.5 6-6 6 6 6" : "m9.5 6 6 6-6 6"} />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.8" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const PhoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" />
    <path d="M10.5 18h3" />
  </Svg>
);

export const IdCardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <circle cx="8.5" cy="11" r="2.2" />
    <path d="M5.5 16a3.2 3.2 0 0 1 6 0M14 10h4.5M14 13.5h3" />
  </Svg>
);

export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5l1.5-2.5h6L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);

export const MicIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </Svg>
);

export const QrIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
    <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
    <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
    <path d="M14.5 14.5h2.5v2.5M20.5 14.5v6h-3.5M14.5 20.5v-1" />
  </Svg>
);

export const TicketIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4z" />
    <path d="M14.5 6v2M14.5 11v2M14.5 16v2" />
  </Svg>
);

export const WalletIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="3.5" y="7.5" width="17" height="11.5" rx="2" />
    <path d="M16 13.2h.01" />
  </Svg>
);
