import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (next: T) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [value, setValue] = useState<T>(
    (searchParams.get(key) as T) || defaultValue
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== defaultValue) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [value, key, defaultValue, pathname, router, searchParams]);

  useEffect(() => {
    setValue((searchParams.get(key) as T) || defaultValue);
  }, [searchParams, key, defaultValue]);

  return [value, setValue];
}
