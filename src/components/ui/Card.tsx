"use client";

import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  children: ReactNode;
}

export function Card({ raised, className, children, ...rest }: CardProps) {
  const classes = ["card", raised && "card-raised", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
