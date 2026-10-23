import { Suspense } from "react";

import { CampaignDetail } from "./campaign-detail";

// Thin server shell: the detail view reads its id with `useParams()` on the
// client, which Next's cache-components mode requires to sit inside a
// Suspense boundary so the static shell can stream around it.
export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CampaignDetail />
    </Suspense>
  );
}
