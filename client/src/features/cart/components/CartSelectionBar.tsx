'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';

/**
 * "☑ Select all ··· Delete" above the lines (DESIGN.md §3.6).
 *
 * Select-all covers the lines that can be bought — an out-of-stock line has no checkbox to tick.
 * Deleting several lines at once asks first; removing one does not, because one line is one
 * click to put back and several are a shopping session.
 */
interface CartSelectionBarProps {
  purchasableCount: number;
  selectedCount: number;
  onSelectAll: (isSelected: boolean) => void;
  onDeleteSelected: () => void;
}

export function CartSelectionBar({
  purchasableCount,
  selectedCount,
  onSelectAll,
  onDeleteSelected,
}: CartSelectionBarProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isAllSelected = purchasableCount > 0 && selectedCount === purchasableCount;
  const items = `${selectedCount} ${selectedCount === 1 ? 'item' : 'items'}`;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-armor-150 px-4">
      <Checkbox
        checked={isAllSelected}
        onCheckedChange={onSelectAll}
        disabled={purchasableCount === 0}
        label={<span className="font-medium">Select all ({purchasableCount})</span>}
      />

      <Button
        variant="ghost"
        onClick={() => setIsConfirming(true)}
        disabled={selectedCount === 0}
        disabledReason="Select items to delete them"
        className="px-2 text-sm"
      >
        Delete
      </Button>

      <Dialog
        open={isConfirming}
        onOpenChange={setIsConfirming}
        title={`Remove ${items} from your cart?`}
        description="Unselected items stay where they are."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsConfirming(false)}>
              Keep them
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setIsConfirming(false);
                onDeleteSelected();
              }}
            >
              Remove {items}
            </Button>
          </>
        }
      />
    </div>
  );
}
