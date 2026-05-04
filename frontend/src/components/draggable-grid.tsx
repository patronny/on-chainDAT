"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CardShell } from "./card-shell";

export interface DraggableSection {
  id: string;
  /** Plain string for static headers, or a live ReactNode for dynamic ones (e.g. progress %). */
  title: ReactNode;
  subtitle?: string;
  /** Renderer is a function so we can avoid wasted renders during drag */
  render: () => ReactNode;
  headerRight?: ReactNode;
}

interface Props {
  /** Stable storage key — both order + collapse state are namespaced under this */
  storageKey: string;
  sections: DraggableSection[];
}

/**
 * DnD-kit-powered vertical sortable list of CardShell blocks.
 * Persists per-storageKey: section order + collapsed-id set in localStorage.
 */
export function DraggableGrid({ storageKey, sections }: Props) {
  // Initial order = section ids in original input order; can be overridden by localStorage
  const initialOrder = useMemo(() => sections.map((s) => s.id), [sections]);
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const orderRaw = localStorage.getItem(`${storageKey}.order`);
      const collapsedRaw = localStorage.getItem(`${storageKey}.collapsed`);
      if (orderRaw) {
        const stored: string[] = JSON.parse(orderRaw);
        // Reconcile: keep only ids that still exist in sections, append new ids at end
        const existing = new Set(initialOrder);
        const reconciled = stored.filter((id) => existing.has(id));
        for (const id of initialOrder) if (!reconciled.includes(id)) reconciled.push(id);
        setOrder(reconciled);
      }
      if (collapsedRaw) setCollapsed(new Set(JSON.parse(collapsedRaw)));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [storageKey, initialOrder]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(`${storageKey}.order`, JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }, [storageKey, order, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(`${storageKey}.collapsed`, JSON.stringify([...collapsed]));
    } catch {
      /* ignore */
    }
  }, [storageKey, collapsed, hydrated]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const byId = new Map(sections.map((s) => [s.id, s]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as DraggableSection[];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4 sm:space-y-6">
          {ordered.map((s) => (
            <CardShell
              key={s.id}
              id={s.id}
              title={s.title}
              subtitle={s.subtitle}
              collapsed={collapsed.has(s.id)}
              onToggle={() => toggle(s.id)}
              headerRight={s.headerRight}
            >
              {s.render()}
            </CardShell>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
