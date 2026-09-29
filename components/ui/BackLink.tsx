"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import React from "react";

interface BackLinkProps {
  href: string;
  label: string;
  className?: string;
}

export function BackLink({ href, label, className }: BackLinkProps) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
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
