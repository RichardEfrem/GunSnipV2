'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { IDLE, type ActionResult } from '../action-result';
import { createReferenceAction, deleteReferenceAction, updateReferenceAction } from '../actions';
import type { AdminCategory, ReferenceItem } from '../schema';
import { ActionFeedback } from './ActionFeedback';
import { AdminInput, AdminSelect } from './AdminField';
import { AdminPanel, AdminTable, Td, Th } from './AdminPanel';

/**
 * One reference table (FR-ADM-09).
 *
 * The same component for grades, scales, series and brands, because they are the same shape: a
 * stable key, a name and a position. Four near-identical components would be four places to fix
 * the same bug.
 *
 * **The key is not editable.** `code` and `slug` are in every shared URL and every saved filter
 * (FR-CAT-07), so they are shown and never offered as a field. A key that has to change is a new
 * row and a redirect, not an edit.
 */
interface ReferenceTableProps {
  table: 'grades' | 'scales' | 'series' | 'brands';
  title: string;
  description: string;
  items: ReferenceItem[];
  /** Grades and scales are keyed by an operator-chosen code; series and brands by a slug. */
  hasCode?: boolean;
  hasDescription?: boolean;
  className?: string;
}

export function ReferenceTable({
  table,
  title,
  description,
  items,
  hasCode = false,
  hasDescription = false,
  className,
}: ReferenceTableProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <AdminPanel
      title={title}
      description={description}
      className={className}
      action={
        <Button variant="secondary" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      }
      isFlush
    >
      {isAdding ? (
        <div className="border-b border-armor-150 bg-armor-050 p-4">
          <CreateForm
            table={table}
            hasCode={hasCode}
            hasDescription={hasDescription}
            onDone={() => setIsAdding(false)}
          />
        </div>
      ) : null}

      <AdminTable className="min-w-0">
        <thead>
          <tr>
            <Th>{hasCode ? 'Code' : 'Web address'}</Th>
            <Th>Name</Th>
            <Th className="text-right">Products</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <RowWithEditor
              key={item.id}
              table={table}
              item={item}
              hasDescription={hasDescription}
              hasPosition={table !== 'brands'}
              isEditing={editingId === item.id}
              onToggle={() => setEditingId(editingId === item.id ? null : item.id)}
            />
          ))}
        </tbody>
      </AdminTable>
    </AdminPanel>
  );
}

function RowWithEditor({
  table,
  item,
  hasDescription,
  hasPosition,
  isEditing,
  onToggle,
}: {
  table: string;
  item: ReferenceItem;
  hasDescription: boolean;
  hasPosition: boolean;
  isEditing: boolean;
  onToggle: () => void;
}) {
  const [result, formAction, isPending] = useActionState(updateReferenceAction.bind(null, table, item.id), IDLE);
  const [deleteResult, setDeleteResult] = useState<ActionResult>(IDLE);
  const [isDeleting, startDelete] = useTransition();

  return (
    <>
      <tr>
        <Td className="font-mono text-xs">{item.key}</Td>
        <Td>{item.name}</Td>
        <Td className="text-right font-mono tabular-nums text-frame-300">{item.usageCount}</Td>
        <Td className="whitespace-nowrap text-right">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isEditing}
            className="reticle rounded-sm px-2 py-1 text-xs text-core-blue hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            title={
              item.usageCount > 0
                ? `${item.usageCount} product${item.usageCount === 1 ? '' : 's'} still use this`
                : `Remove ${item.name}`
            }
            disabled={item.usageCount > 0 || isDeleting}
            onClick={() => startDelete(async () => setDeleteResult(await deleteReferenceAction(table, item.id)))}
            className="reticle rounded-sm p-1.5 text-danger hover:bg-danger-tint disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 className="size-4" aria-hidden />
            <span className="sr-only">Remove {item.name}</span>
          </button>
        </Td>
      </tr>

      {isEditing || deleteResult.status === 'error' ? (
        <tr>
          <td colSpan={4} className="border-b border-armor-150 bg-armor-050 p-4">
            {deleteResult.status === 'error' ? <ActionFeedback result={deleteResult} className="mb-3" /> : null}

            {isEditing ? (
              <form action={formAction} className="flex flex-wrap items-end gap-3">
                <AdminInput label="Name" name="name" defaultValue={item.name} required className="min-w-40 flex-1" />

                {hasDescription ? (
                  <AdminInput
                    label="Description"
                    name="description"
                    defaultValue={item.description ?? ''}
                    isOptional
                    className="min-w-40 flex-1"
                  />
                ) : null}

                {hasPosition ? (
                  <AdminInput
                    label="Position"
                    name="position"
                    type="number"
                    min={0}
                    defaultValue={item.position}
                    className="w-24"
                  />
                ) : null}

                <Button type="submit" variant="secondary" isLoading={isPending}>
                  Save
                </Button>
                <ActionFeedback result={result} className="pb-2.5" />
              </form>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function CreateForm({
  table,
  hasCode,
  hasDescription,
  onDone,
}: {
  table: string;
  hasCode: boolean;
  hasDescription: boolean;
  onDone: () => void;
}) {
  const [result, formAction, isPending] = useActionState(createReferenceAction.bind(null, table), IDLE);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {hasCode ? (
        <AdminInput
          label="Code"
          name="code"
          required
          maxLength={20}
          className="w-28"
          hint="Never changes."
        />
      ) : null}

      <AdminInput label="Name" name="name" required minLength={1} maxLength={120} className="min-w-40 flex-1" />

      {hasDescription ? (
        <AdminInput label="Description" name="description" isOptional className="min-w-40 flex-1" />
      ) : null}

      <AdminInput label="Position" name="position" type="number" min={0} defaultValue={0} className="w-24" />

      <Button type="submit" variant="secondary" isLoading={isPending}>
        Add
      </Button>
      <Button type="button" variant="ghost" onClick={onDone}>
        Done
      </Button>
      <ActionFeedback result={result} className="pb-2.5" />
    </form>
  );
}

/**
 * The category tree (FR-ADM-09).
 *
 * Its own component because a category is the one reference row with a shape: it belongs to a
 * tree, and it belongs to either the kits tree or the tools tree. `depth` comes from the server
 * already computed, so the indentation is a multiplication rather than a tree walk in the
 * browser.
 */
export function CategoryManager({ categories, className }: { categories: AdminCategory[]; className?: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [result, formAction, isPending] = useActionState(createReferenceAction.bind(null, 'categories'), IDLE);
  const [type, setType] = useState<'MODEL_KIT' | 'TOOL_SUPPLY'>('MODEL_KIT');
  const [deleteResult, setDeleteResult] = useState<ActionResult>(IDLE);
  const [isDeleting, startDelete] = useTransition();

  return (
    <AdminPanel
      title="Categories"
      description="Two separate trees — kits and tools are browsed apart. A category cannot move between them."
      className={className}
      action={
        <Button variant="secondary" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      }
      isFlush
    >
      {isAdding ? (
        <form action={formAction} className="flex flex-wrap items-end gap-3 border-b border-armor-150 bg-armor-050 p-4">
          <AdminInput label="Name" name="name" required minLength={2} maxLength={120} className="min-w-40 flex-1" />

          <AdminSelect
            label="Tree"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value === 'TOOL_SUPPLY' ? 'TOOL_SUPPLY' : 'MODEL_KIT')}
            className="w-40"
          >
            <option value="MODEL_KIT">Kits</option>
            <option value="TOOL_SUPPLY">Tools</option>
          </AdminSelect>

          <AdminSelect label="Parent" name="parentId" isOptional className="w-56">
            <option value="">Top level</option>
            {categories
              .filter((category) => category.type === type)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {' '.repeat(category.depth * 2)}
                  {category.name}
                </option>
              ))}
          </AdminSelect>

          <AdminInput label="Position" name="position" type="number" min={0} defaultValue={0} className="w-24" />

          <Button type="submit" variant="secondary" isLoading={isPending}>
            Add
          </Button>
          <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>
            Done
          </Button>
          <ActionFeedback result={result} className="pb-2.5" />
        </form>
      ) : null}

      {deleteResult.status === 'error' ? (
        <div className="border-b border-armor-150 bg-armor-050 px-4 py-3">
          <ActionFeedback result={deleteResult} />
        </div>
      ) : null}

      <AdminTable className="min-w-0">
        <thead>
          <tr>
            <Th>Category</Th>
            <Th>Tree</Th>
            <Th>Web address</Th>
            <Th className="text-right">Products</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <Td>
                <span style={{ paddingLeft: `${category.depth * 1.25}rem` }}>
                  {category.depth > 0 ? <span className="text-frame-300">└ </span> : null}
                  {category.name}
                </span>
              </Td>
              <Td className="text-xs text-frame-300">{category.type === 'MODEL_KIT' ? 'Kits' : 'Tools'}</Td>
              <Td className="font-mono text-xs text-frame-300">/{category.slug}</Td>
              <Td className="text-right font-mono tabular-nums text-frame-300">{category.usageCount}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={
                    category.usageCount > 0
                      ? `${category.usageCount} products are still in this category`
                      : `Remove ${category.name}`
                  }
                  disabled={category.usageCount > 0 || isDeleting}
                  onClick={() =>
                    startDelete(async () => setDeleteResult(await deleteReferenceAction('categories', category.id)))
                  }
                  className="reticle rounded-sm p-1.5 text-danger hover:bg-danger-tint disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="size-4" aria-hidden />
                  <span className="sr-only">Remove {category.name}</span>
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </AdminTable>
    </AdminPanel>
  );
}
