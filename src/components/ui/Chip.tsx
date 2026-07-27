"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warn" | "danger" | "info";
  icon?: IconName;
  /** Inline pair from the data palette (getColorStyle) — beats tone. */
  colorStyle?: CSSProperties;
  children: ReactNode;
}

export function Chip({
  tone = "neutral",
  icon,
  colorStyle,
  className,
  style,
  children,
  ...rest
}: ChipProps) {
  const classes = ["chip", `chip-${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={classes} style={{ ...style, ...colorStyle }} {...rest}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}
