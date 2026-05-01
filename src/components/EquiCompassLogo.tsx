/**
 * EquiCompass logo component.
 * variant="nav"  — compass icon + wordmark, no tagline (for headers)
 * variant="full" — icon + wordmark + tagline (for hero / footer)
 * variant="icon" — compass icon only (for favicon-like usage)
 */

const NAVY  = "#162040";
const BLUE  = "#1a6ef0";
const GREY  = "#7a8fa6";

function CompassIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Outer ring */}
      <circle cx="50" cy="50" r="34" fill="none" stroke={NAVY} strokeWidth="3.5" />

      {/* Cardinal point diamonds — N S E W */}
      {/* North */}
      <polygon points="50,12 54.5,26 50,32 45.5,26" fill={NAVY} />
      {/* South */}
      <polygon points="50,88 54.5,74 50,68 45.5,74" fill={NAVY} />
      {/* East */}
      <polygon points="88,50 74,54.5 68,50 74,45.5" fill={NAVY} />
      {/* West */}
      <polygon points="12,50 26,54.5 32,50 26,45.5" fill={NAVY} />

      {/* Compass needle — pointing NE, blue tip / dark tail */}
      <g transform="translate(50,50) rotate(45)">
        {/* NE / blue half */}
        <path d="M 0 0 L -7 -8 L 0 -29 L 7 -8 Z" fill={BLUE} />
        {/* SW / dark half */}
        <path d="M 0 0 L 7 8 L 0 29 L -7 8 Z" fill={NAVY} />
        {/* Center pivot */}
        <circle r="4.5" fill="white" stroke={NAVY} strokeWidth="1.5" />
      </g>
    </svg>
  );
}

interface LogoProps {
  variant?: "nav" | "full" | "icon";
  /** Override icon size (px) */
  iconSize?: number;
  /** Extra className on root element */
  className?: string;
  /** Invert wordmark colours for use on dark backgrounds */
  dark?: boolean;
}

export function EquiCompassLogo({ variant = "nav", iconSize, className = "", dark = false }: LogoProps) {
  const navyColor  = dark ? "white"  : NAVY;
  const greyColor  = dark ? "rgba(255,255,255,0.55)" : GREY;

  if (variant === "icon") {
    return <CompassIcon size={iconSize ?? 36} />;
  }

  if (variant === "full") {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <CompassIcon size={iconSize ?? 52} />
        <div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: "2rem", letterSpacing: "0.08em", lineHeight: 1 }}>
            <span style={{ color: navyColor }}>EQUI</span>
            <span style={{ color: BLUE }}>COMPASS</span>
          </div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: "0.6875rem", letterSpacing: "0.18em", color: greyColor, marginTop: "4px" }}>
            NAVIGATE CAPITAL.&nbsp; PROTECT CONTROL.&nbsp; BUILD LEGACY.
          </div>
        </div>
      </div>
    );
  }

  // variant === "nav"
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <CompassIcon size={iconSize ?? 30} />
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: "1.0625rem", letterSpacing: "0.06em", lineHeight: 1 }}>
        <span style={{ color: navyColor }}>EQUI</span>
        <span style={{ color: BLUE }}>COMPASS</span>
      </span>
    </div>
  );
}
