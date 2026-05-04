"use client";

import { CSSProperties, ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "./ui/card";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";

interface CardShellProps {
  id: string;
  /** Title can be a plain string or a live React node for dynamic headers (e.g. "55.5% Progress…"). */
  title: ReactNode;
  subtitle?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Optional adornment shown on the right of the header before the collapse button */
  headerRight?: ReactNode;
}

/**
 * Draggable + collapsible card wrapper.
 * Header: [drag handle] [title + subtitle] [headerRight] [collapse toggle]
 * Body: hidden when collapsed.
 */
export function CardShell({ id, title, subtitle, collapsed, onToggle, children, headerRight }: CardShellProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={isDragging ? "shadow-lg ring-2 ring-primary/40" : ""}>
        <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1 touch-none"
            aria-label={typeof title === "string" ? `Drag ${title}` : "Drag card"}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider truncate">{title}</h3>
            {subtitle ? <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p> : null}
          </div>
          {headerRight ? <div className="flex-shrink-0">{headerRight}</div> : null}
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            aria-label={collapsed ? "Expand card" : "Collapse card"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {!collapsed ? <div>{children}</div> : null}
      </Card>
    </div>
  );
}
