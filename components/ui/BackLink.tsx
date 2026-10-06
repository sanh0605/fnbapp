"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import React from "react";
import { getRememberedUrl } from "./AdminRouteMemory";

interface BackLinkProps {
  href: string;
  label: string;
  className?: string;
}

export function BackLink({ href, label, className }: BackLinkProps) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Plain left click only, no modifier keys
    if (e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) {
      return;
    }

    try {
      const pathname = href.split("?")[0];
      const remembered = getRememberedUrl(pathname);
      if (remembered) {
        e.preventDefault();
        router.push(remembered);
      }
    } catch {
      // Storage exception guard: let standard Link navigation to href proceed
    }
  };

  return (
    <Link
      href={href}
      onClick={handleBack}
      className={className || "text-sm font-medium text-primary hover:text-primary-hover no-underline self-start inline-block"}
    >
      &larr; {label}
    </Link>
  );
}
