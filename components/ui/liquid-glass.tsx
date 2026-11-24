import React from "react";

type GlassProps = React.PropsWithChildren<{
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
}>;

export function GlassEffect({ children, className = "", style, href, target }: GlassProps) {
  const props = { className: "glass-panel " + className, style };
  return href ? <a {...props} href={href} target={target} rel="noopener noreferrer">{children}</a> : <div {...props}>{children}</div>;
}
