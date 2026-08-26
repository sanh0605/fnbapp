/**
 * `npm run preview` -- starts `next dev` bound to 0.0.0.0 and prints an
 * address a phone on the same wifi can actually type in.
 *
 * docs/superpowers/plans/2026-08-26-ui-feedback-tool.md section 3.
 * `next dev -H 0.0.0.0` alone is not enough: checked directly against a
 * real server, its own "Network:" banner line prints
 * "http://0.0.0.0:<port>" verbatim -- a phone cannot connect to 0.0.0.0.
 * The actual LAN address has to be detected, not read off Next's own
 * output.
 *
 * Prints every non-internal IPv4 address found rather than guessing which
 * one is the real wifi adapter -- a machine with a VPN, Docker or WSL
 * installed often has several, and picking wrong silently would be worse
 * than showing all of them.
 *
 * `npm run dev` is untouched -- other work depends on it (plan section 3).
 */
import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";
import { lanAddresses } from "./lan-address";

const port = process.env.PORT || "3000";
const addresses = lanAddresses(networkInterfaces());

console.log("");
console.log(`  Trên máy tính này:      http://localhost:${port}`);
if (addresses.length > 0) {
  for (const addr of addresses) {
    console.log(`  Trên điện thoại (cùng wifi): http://${addr}:${port}`);
  }
} else {
  console.log("  Không tìm thấy địa chỉ mạng LAN -- máy có đang nối wifi hoặc mạng dây không?");
}
console.log("");

// shell: true is required on Windows -- npx resolves to a .cmd shim, and
// Node's spawn() cannot execute .cmd files directly without a shell
// (confirmed directly: spawning "npx.cmd" without shell: true fails with
// EINVAL). Node's own deprecation warning about shell: true is about
// unescaped argument concatenation from untrusted input; port here comes
// only from a developer's own local PORT env var, never network input.
const child = spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: true,
});
child.on("exit", code => process.exit(code ?? 0));
