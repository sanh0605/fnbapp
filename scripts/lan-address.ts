/**
 * Pure logic for scripts/preview.ts. Split out so it is testable without
 * touching the real network interfaces -- same reasoning as
 * scripts/check-rules-current.ts / check-rules-current-core.ts.
 */
import type { NetworkInterfaceInfo } from "node:os";

export type NetworkInterfaces = Record<string, NetworkInterfaceInfo[] | undefined>;

// Every non-internal IPv4 address found, not a single guess -- a machine
// with a VPN, Docker or WSL installed often has several adapters, and
// silently picking the wrong one is worse than listing all of them.
export function lanAddresses(interfaces: NetworkInterfaces): string[] {
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}
