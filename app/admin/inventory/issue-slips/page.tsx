import { getIssueSlipFormData } from "./actions";
import { IssueSlipClient } from "./components/IssueSlipClient";

export const dynamic = "force-dynamic";

export default async function IssueSlipsPage() {
  const items = await getIssueSlipFormData();
  return <IssueSlipClient items={items} />;
}
