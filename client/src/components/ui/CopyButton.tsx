'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Copies a string and says so (DESIGN.md §3.8 — the account number on the confirmation page).
 *
 * The confirmation is spoken as well as shown: a customer retyping a twelve-digit account number
 * needs to know it went to the clipboard, and colour alone would not say it (DESIGN.md §6). The
 * label reverts after a moment so the control does not read as permanently "done".
 */
const CONFIRMATION_MS = 2000;

interface CopyButtonProps {
  value: string;
  /** Names *what* is being copied, for a screen reader: "Copy account number". */
  label: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return undefined;

    const timer = setTimeout(() => setIsCopied(false), CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [isCopied]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
    } catch {
      // Denied permission, or an insecure origin. Nothing to announce — the number is on screen
      // and selectable, which is the fallback either way.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        'reticle relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm px-3',
        'text-sm font-medium text-core-blue transition-colors duration-fast ease-out hover:bg-core-blue-tint',
        className,
      )}
    >
      {isCopied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {isCopied ? 'Copied' : 'Copy'}
      <span role="status" className="sr-only">
        {isCopied ? `${label} copied.` : ''}
      </span>
    </button>
  );
}
