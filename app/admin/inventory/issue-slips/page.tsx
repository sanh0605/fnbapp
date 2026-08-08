import { getIssueSlipFormData, getRecentIssueSlips } from "./actions";
import { IssueSlipClient } from "./components/IssueSlipClient";

export const dynamic = "force-dynamic";

export default async function IssueSlipsPage() {
  const [items, recentSlips] = await Promise.all([getIssueSlipFormData(), getRecentIssueSlips()]);
  return <IssueSlipClient items={items} recentSlips={recentSlips} />;
}
