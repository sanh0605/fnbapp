import { describe, expect, it } from "vitest";
import { lanAddresses } from "./lan-address";

function iface(family: "IPv4" | "IPv6", address: string, internal: boolean): any {
  return { family, address, internal, mac: "", netmask: "", cidr: null };
}

describe("lanAddresses", () => {
  it("returns the non-internal IPv4 address of a single-adapter machine", () => {
    const interfaces = {
      "Wi-Fi": [iface("IPv4", "192.168.1.42", false), iface("IPv6", "fe80::1", false)],
      "Loopback": [iface("IPv4", "127.0.0.1", true)],
    };
    expect(lanAddresses(interfaces)).toEqual(["192.168.1.42"]);
  });

  it("returns every candidate when more than one adapter has a non-internal IPv4", () => {
    const interfaces = {
      "Wi-Fi": [iface("IPv4", "192.168.1.42", false)],
      "vEthernet (WSL)": [iface("IPv4", "172.20.0.1", false)],
      "Loopback": [iface("IPv4", "127.0.0.1", true)],
    };
    expect(lanAddresses(interfaces)).toEqual(["192.168.1.42", "172.20.0.1"]);
  });

  it("returns an empty list when there is no real network adapter", () => {
    const interfaces = { "Loopback": [iface("IPv4", "127.0.0.1", true)] };
    expect(lanAddresses(interfaces)).toEqual([]);
  });

  it("skips an interface with no entries", () => {
    const interfaces = { "Disabled": undefined };
    expect(lanAddresses(interfaces)).toEqual([]);
  });
});
