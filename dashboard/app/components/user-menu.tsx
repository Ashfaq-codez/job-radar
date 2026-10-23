import Link from "next/link";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

function Avatar({ user, size = "size-8" }: { user: CurrentUser; size?: string }) {
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();
  return user.image ? (
    // Google profile photo; no-referrer so Google doesn't see which page asked for it
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.image} alt="" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white/20`} />
  ) : (
    <span aria-hidden="true" className={`${size} grid shrink-0 place-items-center rounded-full bg-spark text-sm font-bold text-side`}>{initial}</span>
  );
}

// Signed-in person: a small avatar link on phones and the icon rail, a full card on desktop
export async function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;

  if (compact) {
    return (
      <Link
        href="/settings"
        title="Settings"
        aria-label={`Settings for ${user.name}`}
        className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark md:mx-auto md:mt-auto lg:hidden"
      >
        <Avatar user={user} />
      </Link>
    );
  }

  const link = "rounded-lg px-2 py-1 text-xs font-medium text-side-muted transition-colors hover:bg-white/10 hover:text-side-ink focus-visible:outline-2 focus-visible:outline-spark";
  return (
    <section aria-label="Your account" className="hidden shrink-0 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 lg:block">
      <div className="flex items-center gap-3">
        <Avatar user={user} size="size-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-side-ink">{user.name}</p>
          <p className="truncate text-xs text-side-muted">{user.email}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Link href="/settings" className={link}>Settings</Link>
        {user.isOwner && <Link href="/admin/invites" className={link}>Admin</Link>}
        <SignOutButton className={link} />
      </div>
    </section>
  );
}
