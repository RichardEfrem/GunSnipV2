'use client';

import { NECESSITIES, type Necessity } from '@gunsnip/shared';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { NECESSITY_LABELS } from '@/lib/labels';
import { IDLE, type ActionResult } from '../action-result';
import { setRequirementsAction } from '../actions';
import type { AdminProduct, AdminProductSummary } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminPanel } from './AdminPanel';

/**
 * The build-requirement editor (FR-ADM-06) — which tools a kit needs (PRD §5.3).
 *
 * This list is exactly what the customer sees in "What you'll need to build this" (FR-PDP-08),
 * in this order, so the editor is a list the operator arranges and saves rather than a set of
 * add and remove buttons that each hit the server. The whole arrangement goes in one `PUT`,
 * which is what makes saving idempotent.
 *
 * The draft lives in component state because it is genuinely unsaved work — the one case where
 * local state is right, as against a filter, which belongs in the URL.
 */
interface DraftLine {
  toolProductId: string;
  necessity: Necessity;
  reason: string;
}

export function ProductRequirementsEditor({
  product,
  tools,
}: {
  product: AdminProduct;
  tools: AdminProductSummary[];
}) {
  const [lines, setLines] = useState<DraftLine[]>(() =>
    product.requirements.map((requirement) => ({
      toolProductId: requirement.toolProductId,
      necessity: requirement.necessity,
      reason: requirement.reason ?? '',
    })),
  );
  const [result, setResult] = useState<ActionResult>(IDLE);
  const [isSaving, startTransition] = useTransition();

  const chosen = new Set(lines.map((line) => line.toolProductId));
  const available = tools.filter((tool) => !chosen.has(tool.id));

  function update(index: number, patch: Partial<DraftLine>): void {
    setLines(lines.map((line, at) => (at === index ? { ...line, ...patch } : line)));
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= lines.length) return;

    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    setLines(next);
  }

  function save(): void {
    startTransition(async () => {
      setResult(
        await setRequirementsAction(
          product.id,
          lines.map((line) => ({
            toolProductId: line.toolProductId,
            necessity: line.necessity,
            reason: line.reason.trim().length === 0 ? null : line.reason.trim(),
          })),
        ),
      );
    });
  }

  return (
    <AdminPanel
      title="Build requirements"
      description="What the customer is told they need. Order matters — it is the order they see."
      action={
        <div className="flex items-center gap-3">
          <ActionFeedback result={result} />
          <Button variant="secondary" isLoading={isSaving} onClick={save}>
            Save requirements
          </Button>
        </div>
      }
    >
      {lines.length === 0 ? (
        <p className="mb-4 text-sm text-frame-300">
          Nothing listed. A kit with no requirements shows no “what you’ll need” block at all.
        </p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {lines.map((line, index) => {
            const tool = tools.find((candidate) => candidate.id === line.toolProductId);

            return (
              <li key={line.toolProductId} className="grid gap-3 rounded-sm border border-armor-150 p-3 sm:grid-cols-[1fr_10rem_auto]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tool?.name ?? 'A tool that is no longer published'}</p>
                  <input
                    value={line.reason}
                    onChange={(event) => update(index, { reason: event.target.value })}
                    maxLength={300}
                    placeholder="Why, in the customer's words"
                    aria-label={`Why ${tool?.name ?? 'this tool'} is needed`}
                    className="mt-1.5 h-9 w-full rounded-sm border border-field-border bg-armor-000 px-2 text-sm placeholder:text-frame-300 focus-visible:border-core-blue"
                  />
                </div>

                <label className="flex flex-col gap-1 text-xs font-medium text-frame-300">
                  Necessity
                  <select
                    value={line.necessity}
                    onChange={(event) => update(index, { necessity: event.target.value as Necessity })}
                    className="h-9 rounded-sm border border-field-border bg-armor-000 px-2 text-sm focus-visible:border-core-blue"
                  >
                    {NECESSITIES.map((necessity) => (
                      <option key={necessity} value={necessity}>
                        {NECESSITY_LABELS[necessity]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end gap-1">
                  <RowButton label={`Move ${tool?.name ?? 'tool'} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp className="size-4" aria-hidden />
                  </RowButton>
                  <RowButton
                    label={`Move ${tool?.name ?? 'tool'} down`}
                    disabled={index === lines.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </RowButton>
                  <RowButton
                    label={`Remove ${tool?.name ?? 'tool'}`}
                    isDanger
                    onClick={() => setLines(lines.filter((_, at) => at !== index))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </RowButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-armor-150 pt-4">
        <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-xs font-medium text-frame-300">
          Add a tool
          <select
            value=""
            onChange={(event) => {
              if (event.target.value === '') return;
              setLines([...lines, { toolProductId: event.target.value, necessity: 'REQUIRED', reason: '' }]);
            }}
            className="h-10 rounded-sm border border-field-border bg-armor-000 px-3 text-sm focus-visible:border-core-blue"
          >
            <option value="">
              {available.length === 0 ? 'Every published tool is already listed' : 'Choose a tool'}
            </option>
            {available.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.name}
              </option>
            ))}
          </select>
        </label>

        <span className="pb-2 text-xs text-frame-300">
          <Plus className="mr-1 inline size-3.5" aria-hidden />
          Added tools are not saved until you press Save requirements.
        </span>
      </div>
    </AdminPanel>
  );
}

function RowButton({
  label,
  onClick,
  disabled,
  isDanger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isDanger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`reticle rounded-sm p-1.5 transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
        isDanger ? 'text-danger hover:bg-danger-tint' : 'text-frame-300 hover:bg-ink-tint hover:text-ink'
      }`}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
