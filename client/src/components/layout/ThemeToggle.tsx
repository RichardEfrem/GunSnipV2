'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark' | 'system';

const OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Switches themes by setting `data-theme` on <html>, which pins `color-scheme` and settles
 * every `light-dark()` token underneath it — see `styles/tokens.css`. "System" removes the
 * attribute and hands the decision back to `prefers-color-scheme`.
 *
 * Not part of the header: DESIGN.md does not specify a theme control in the chrome, so this
 * exists for the design-system gallery, where proving both themes is an exit criterion.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-sm border border-armor-150 bg-armor-000 p-1"
    >
      <Sun className="ml-1 size-4 text-frame-300" aria-hidden />

      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={theme === option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            'reticle h-8 rounded-sm px-2.5 text-xs transition-colors duration-fast ease-out',
            theme === option.value ? 'bg-core-blue text-white' : 'text-frame-300 hover:bg-ink-tint hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}

      <Moon className="mr-1 size-4 text-frame-300" aria-hidden />
    </div>
  );
}
