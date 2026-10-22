import { Suspense } from "react";

import { CampaignDetail } from "./campaign-detail";

// Thin server shell; see guests/[id]/page.tsx for why the Suspense boundary.
export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CampaignDetail />
    </Suspense>
  );
}
