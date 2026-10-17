"use client";

import { useEffect, useState } from "react";
import { getMyStaffName } from "./actions";

// The login until the staff name arrives, or for good if the lookup fails.
export function useMyStaffName(login: string | null | undefined): string | null | undefined {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    getMyStaffName().then(setName, () => {});
  }, [login]);
  return name ?? login;
}
