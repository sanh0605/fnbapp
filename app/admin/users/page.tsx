import { getUsers } from "./actions";
import UsersClient from "./components/UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await getUsers();
  return <UsersClient users={users} />;
}
