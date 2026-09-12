'use client';

import { LogOut } from 'lucide-react';
import { useTransition } from 'react';
import { signOutAction } from '../sign-in-actions';

/** Clears the admin cookie and returns to sign-in. */
export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOutAction())}
      aria-busy={isPending || undefined}
      className="reticle flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-frame-muted transition-colors duration-fast ease-out hover:bg-frame-500/40 hover:text-white"
    >
      <LogOut className="size-4" aria-hidden />
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
