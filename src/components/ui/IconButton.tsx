"use client";

import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./icons";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Accessible name — icon-only buttons must always have one. */
  label: string;
  size?: number;
  filled?: boolean;
}

export function IconButton({
  icon,
  label,
  size = 16,
  filled,
  className,
  ...rest
}: IconButtonProps) {
  const classes = ["icon-btn", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} aria-label={label} {...rest}>
      <Icon name={icon} size={size} filled={filled} />
    </button>
  );
}
