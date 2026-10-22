import { Suspense } from "react";

import { GuestProfile } from "./guest-profile";

// Thin server shell: the profile reads its id with `useParams()` on the
// client, which Next's cache-components mode requires to sit inside a
// Suspense boundary so the static shell can stream around it.
export default function GuestProfilePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <GuestProfile />
    </Suspense>
  );
}
