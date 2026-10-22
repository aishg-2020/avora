import Link from "next/link";

/** Name rendered as a link to the guest's profile page. */
export function GuestLink({ id, name }: { id: string; name: string | undefined }) {
  return (
    <Link href={`/guests/${id}`} className="hover:text-accent hover:underline">
      {name ?? id}
    </Link>
  );
}
