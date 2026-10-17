import { resolveActor } from "@/lib/auth/auth";
import { loadStaffNameResolver } from "@/lib/auth/staff-names";
import { AdminFrame } from "./AdminFrame";

// Server side, so the sidebar's first paint already shows users.name. The session keeps the
// login as its name (it is what gets stored on records), so the name is read from users here.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await resolveActor();
  const staffName = auth.ok ? (await loadStaffNameResolver())(auth.actor.name, auth.actor.id) : null;
  return <AdminFrame staffName={staffName}>{children}</AdminFrame>;
}
