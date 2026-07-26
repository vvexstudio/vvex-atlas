"use client";

import type { ButtonHTMLAttributes } from "react";
import { IconButton } from "./IconButton";

export function CloseButton({
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = ["close-btn", className].filter(Boolean).join(" ");
  return <IconButton icon="x" label="Close" className={classes} {...rest} />;
}
