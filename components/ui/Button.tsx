import React from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

type Variant = "primary" | "secondary" | "delete" | "danger";

type CommonProps = {
  variant?: Variant;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export type ButtonProps =
  | (CommonProps & { href?: undefined } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">)
  | (CommonProps & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href">);

const variantStyles: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active",
  secondary: "bg-surface-card text-text-primary border border-border hover:bg-page",
  delete: "bg-surface-card text-danger border border-danger hover:bg-danger/5",
  danger: "bg-danger text-white hover:bg-danger/90",
};

const baseStyle =
  "relative inline-flex items-center justify-center gap-2 min-h-[48px] md:min-h-[40px] px-4 rounded-button text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50 disabled:pointer-events-none";

export function Button(props: ButtonProps) {
  const { variant = "primary", loading = false, className = "", children } = props;
  const classes = `${baseStyle} ${variantStyles[variant]} ${className}`.trim();

  if (props.href !== undefined) {
    const {
      href,
      variant: _variant,
      loading: _loading,
      className: _className,
      children: _children,
      ...anchorProps
    } = props;
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {children}
      </Link>
    );
  }

  const {
    variant: _variant,
    loading: _loading,
    className: _className,
    children: _children,
    disabled,
    ...buttonProps
  } = props;

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {loading ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin absolute" />
          <span className="invisible">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
