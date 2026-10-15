import { findAll } from "@/lib/db/tables";
import LoginForm from "./components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // A database hiccup must not take the login page down with it.
  const brands = await findAll("Brands").catch(() => []);
  const names = brands.filter((b: any) => b.status === "ACTIVE").map((b: any) => b.name);
  return <LoginForm title={names.join(" · ") || "Đăng nhập"} />;
}
