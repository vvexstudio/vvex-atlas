import React from "react";

interface CalendarChipProps {
  variant: "header" | "status-tag";
  style?: React.CSSProperties;
  label?: string;
  icon?: React.ReactNode;
  status?: string;
  onClick?: () => void;
  title?: string;
  tooltipContent?: React.ReactNode;
}

export const CalendarChip: React.FC<CalendarChipProps> = ({
  variant,
  style,
  label,
  icon,
  status = "TBD",
  onClick,
  title,
  tooltipContent
}) => {
  if (variant === "header") {
    return (
      <div 
        className="calendar-chip variant-header" 
        style={style}
        title={title}
      >
        {icon && <span className="calendar-chip-icon">{icon}</span>}
        <span className="calendar-chip-label">{label}</span>
        {tooltipContent && (
          <div className="dept-contact-tooltip">
            <div className="tooltip-header" style={style}>
              <span>{icon} {label}</span>
            </div>
            {tooltipContent}
          </div>
        )}
      </div>
    );
  }

  // Variant 2: status-tag
  return (
    <div 
      className="calendar-chip variant-tag" 
      style={style}
      onClick={onClick}
      title={title}
    >
      <span className="calendar-chip-badge">{status}</span>
      <span className="calendar-chip-label">{label}</span>
    </div>
  );
};
