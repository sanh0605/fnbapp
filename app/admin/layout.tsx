import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth";
import { loadStaffNameResolver } from "@/lib/auth/staff-names";
import { AdminFrame } from "./AdminFrame";

// Server side, so the sidebar's first paint already shows users.name. The session keeps the
// login as its name (it is what gets stored on records); the name comes from the cached users
// list, so the frame adds no uncached query. Access is checked by proxy.ts and each action.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = (await getServerSession(authOptions))?.user as { id?: string; name?: string | null } | undefined;
  const staffName = user ? (await loadStaffNameResolver())(user.name, user.id) : null;
  return <AdminFrame staffName={staffName}>{children}</AdminFrame>;
}
