import Link from "next/link";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { Dropdown } from "./dropdown";
import { SignOutButton } from "./sign-out-button";

const GEAR = "M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 5.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm7.4-.4-1.5-.9a6 6 0 0 0 0-1.4l1.5-.9a.5.5 0 0 0 .2-.6l-1.5-2.6a.5.5 0 0 0-.6-.2l-1.6.7a6 6 0 0 0-1.2-.7L12.5 3a.5.5 0 0 0-.5-.4H9a.5.5 0 0 0-.5.4l-.3 1.8c-.4.2-.8.4-1.2.7l-1.6-.7a.5.5 0 0 0-.6.2L3.3 7.6a.5.5 0 0 0 .1.6l1.5.9a6 6 0 0 0 0 1.4l-1.5.9a.5.5 0 0 0-.1.6l1.5 2.6c.1.2.4.3.6.2l1.6-.7c.4.3.8.5 1.2.7l.3 1.8c0 .2.3.4.5.4h3c.2 0 .5-.2.5-.4l.3-1.8c.4-.2.8-.4 1.2-.7l1.6.7c.2.1.5 0 .6-.2l1.5-2.6a.5.5 0 0 0-.2-.6Z";
const SHIELD = "M10 1.5 3.5 4v5c0 4.1 2.8 7.9 6.5 9 3.7-1.1 6.5-4.9 6.5-9V4L10 1.5Zm-1 11.6-3-3 1.1-1.1L9 10.9l3.9-3.9L14 8.1l-5 5Z";

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-muted" fill="currentColor">
      <path d={d} />
    </svg>
  );
}

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

// Signed-in person: an avatar with a dropdown menu on phones and the icon rail, a full card on desktop
export async function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;

  if (compact) {
    const item =
      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent";
    return (
      <Dropdown className="group/user relative shrink-0 md:mx-auto md:mt-auto lg:hidden">
        <summary
          title="Account"
          className="flex cursor-pointer list-none rounded-full ring-offset-2 ring-offset-side transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark group-open/user:ring-2 group-open/user:ring-spark [&::-webkit-details-marker]:hidden"
        >
          <Avatar user={user} />
          <span className="sr-only">Account menu for {user.name}</span>
        </summary>
        {/* Phones: drops down from the top bar. Icon rail: opens to the right of the avatar. */}
        <div className="animate-fade-in absolute right-0 top-full z-40 mt-3 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-rule bg-surface shadow-lift md:bottom-0 md:left-full md:right-auto md:top-auto md:ml-4 md:mt-0">
          <div className="flex items-center gap-3 bg-gradient-to-br from-accent-soft to-surface p-4">
            <Avatar user={user} size="size-11" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
              {user.isOwner && (
                <span className="mt-1 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface">Owner</span>
              )}
            </div>
          </div>
          <nav aria-label="Account" className="p-2">
            <Link href="/settings" className={item}>
              <Icon d={GEAR} /> Settings
            </Link>
            {user.isOwner && (
              <Link href="/admin/invites" className={item}>
                <Icon d={SHIELD} /> Admin · Invites
              </Link>
            )}
          </nav>
          <div className="border-t border-rule p-2">
            <SignOutButton className={`${item} text-rejected hover:bg-rejected-soft focus-visible:outline-rejected`} />
          </div>
        </div>
      </Dropdown>
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
