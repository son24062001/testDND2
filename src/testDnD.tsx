import React, { useState, useCallback } from "react";
import type { JSX } from "react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  useDroppable,
  useDraggable,
  
} from "@dnd-kit/core";
import {
  useSortable,
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import type { DragOverEvent, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ────────────────────────────────────────────────────────────────────
type FieldType =
  | "text" | "number" | "decimal" | "date" | "multiline" | "richtext"
  | "password" | "attachment" | "textlist" | "email" | "radio" | "switch"
  | "slider" | "checkbox" | "checkboxgroup" | "select";

interface FieldProps {
  label: string;
  placeholder?: string;
  required: boolean;
  rows?: number;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

interface Field {
  id: string;
  type: FieldType;
  props: FieldProps;
  createdAt: string; // ISO datetime string
}

interface SidebarItemData {
  type: FieldType;
  label: string;
  icon: IconName;
}

interface SidebarGroup {
  label: string;
  items: SidebarItemData[];
}

type ActiveItemKind =
  | { kind: "sidebar"; type: FieldType; label: string }
  | { kind: "row"; rowId: string };

type GridSlot = "full" | "col0" | "col1" | "col2";

interface RowField {
  field: Field;
  slot: GridSlot;
}

interface Row {
  id: string;
  cells: RowField[];
  // colWidths[i] = fractional width of column i, sum = 1. Only used when cells.length > 1.
  colWidths: number[]; // length matches cells.length (2 or 3)
}

interface DropTarget {
  rowId: string | "new";
  slot: GridSlot;
}

type IconName =
  | "text" | "number" | "decimal" | "date" | "multiline" | "richtext"
  | "password" | "attachment" | "textlist" | "email" | "radio" | "switch"
  | "slider" | "checkbox" | "checkboxgroup" | "select"
  | "grip" | "trash" | "eye" | "settings" | "plus" | "search" | "edit" | "chevronDown";

// ─── Constants ────────────────────────────────────────────────────────────────
const icons: Record<IconName, string> = {
  text: "M4 6h16M12 6v14",
  number: "M4 9h16M4 15h16M10 3L8 21M16 3l-2 18",
  decimal: "M12 2v20M2 12h20",
  date: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-3-2v4M8 2v4M3 10h18",
  multiline: "M4 6h16M4 10h16M4 14h10M4 18h14",
  richtext: "M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z",
  password: "M6 10h12v10H6zM9 10V7a3 3 0 016 0v3",
  attachment: "M6 7.91V16a6 6 0 006 6 6 6 0 006-6V6a4 4 0 00-4-4 4 4 0 00-4 4v9.18a2 2 0 002 2 2 2 0 002-2V8",
  textlist: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  email: "M3 8l9 6 9-6v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm0-2a2 2 0 012-2h14a2 2 0 012 2L12 12 3 6z",
  radio: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-5a4 4 0 110-8 4 4 0 010 8z",
  switch: "M5 15a3 3 0 110-6h14a3 3 0 110 6H5zm14-3a1 1 0 100-2 1 1 0 000 2z",
  slider: "M4 12h16M9 12a3 3 0 116 0 3 3 0 01-6 0z",
  checkbox: "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  checkboxgroup: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 3h6v4H9z",
  select: "M19 9l-7 7-7-7",
  grip: "M9 5h2M9 12h2M9 19h2M13 5h2M13 12h2M13 19h2",
  trash: "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  chevronDown: "M6 9l6 6 6-6",
};

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    label: "Data entry",
    items: [
      { type: "text", label: "Text", icon: "text" },
      { type: "number", label: "Number", icon: "number" },
      { type: "decimal", label: "Decimal", icon: "decimal" },
      { type: "date", label: "Date", icon: "date" },
      { type: "multiline", label: "Multiline Text", icon: "multiline" },
      { type: "richtext", label: "Rich Text", icon: "richtext" },
      { type: "password", label: "Password", icon: "password" },
      { type: "attachment", label: "Attachment", icon: "attachment" },
      { type: "textlist", label: "Text List", icon: "textlist" },
      { type: "email", label: "Email", icon: "email" },
    ],
  },
  {
    label: "Selection",
    items: [
      { type: "radio", label: "Radio Buttons", icon: "radio" },
      { type: "switch", label: "Switch", icon: "switch" },
      { type: "slider", label: "Slider", icon: "slider" },
      { type: "checkbox", label: "Checkbox", icon: "checkbox" },
      { type: "checkboxgroup", label: "Checkbox Group", icon: "checkboxgroup" },
      { type: "select", label: "Select (Single)", icon: "select" },
    ],
  },
];

const defaultProps: Record<FieldType, FieldProps> = {
  text: { label: "Text Field", placeholder: "Enter text...", required: false },
  number: { label: "Number Field", placeholder: "0", required: false },
  decimal: { label: "Decimal Field", placeholder: "0.00", required: false },
  date: { label: "Date Field", required: false },
  multiline: { label: "Multiline Text", placeholder: "Enter text...", required: false, rows: 3 },
  richtext: { label: "Rich Text", required: false },
  password: { label: "Password", required: false },
  attachment: { label: "Attachment", required: false },
  textlist: { label: "Text List", required: false },
  email: { label: "Email", placeholder: "email@example.com", required: false },
  radio: { label: "Radio Buttons", options: ["Option 1", "Option 2", "Option 3"], required: false },
  switch: { label: "Switch", required: false },
  slider: { label: "Slider", min: 0, max: 100, step: 1, required: false },
  checkbox: { label: "Checkbox", required: false },
  checkboxgroup: { label: "Checkbox Group", options: ["Option 1", "Option 2"], required: false },
  select: { label: "Select", options: ["Option 1", "Option 2", "Option 3"], required: false },
};

// ─── Icon ─────────────────────────────────────────────────────────────────────
function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// Icon 6 chấm 2×3 — dùng cho grip handle từng ô
function GripDots({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  const r = size * 0.115;
  const x1 = size * 0.32, x2 = size * 0.68;
  const y1 = size * 0.18, y2 = size * 0.5, y3 = size * 0.82;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill={color}>
      <circle cx={x1} cy={y1} r={r} /><circle cx={x2} cy={y1} r={r} />
      <circle cx={x1} cy={y2} r={r} /><circle cx={x2} cy={y2} r={r} />
      <circle cx={x1} cy={y3} r={r} /><circle cx={x2} cy={y3} r={r} />
    </svg>
  );
}

// ─── FieldRenderer ────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", background: "#f5f5f5", border: "1px solid #d1d5db",
  color: "#1e293b", borderRadius: 4, padding: "6px 10px", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};

function renderField(type: FieldType, props: FieldProps): JSX.Element {
  switch (type) {
    case "text": case "email": case "password": case "number": case "decimal":
      return <input type={type === "decimal" ? "number" : type} placeholder={props.placeholder} style={inputStyle} />;
    case "date":
      return <input type="date" style={inputStyle} />;
    case "multiline":
      return <textarea rows={props.rows || 3} placeholder={props.placeholder} style={{ ...inputStyle, resize: "vertical" }} />;
    case "richtext":
      return <div style={{ ...inputStyle, minHeight: 80 }} />;
    case "radio":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(props.options || []).map((o, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: "#1e293b", fontSize: 13, cursor: "pointer" }}>
              <input type="radio" name={`radio_${Math.random()}`} style={{ accentColor: "#3b9eff" }} /> {o}
            </label>
          ))}
        </div>
      );
    case "switch":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 36, height: 20, background: "#3b9eff", borderRadius: 10, position: "relative" }}>
            <div style={{ width: 16, height: 16, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: 18 }} />
          </div>
          <span style={{ color: "#1e293b", fontSize: 13 }}>Enabled</span>
        </label>
      );
    case "slider":
      return <input type="range" min={props.min ?? 0} max={props.max ?? 100} style={{ width: "100%", accentColor: "#3b9eff" }} />;
    case "checkbox":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" style={{ accentColor: "#3b9eff", width: 15, height: 15 }} />
          <span style={{ color: "#1e293b", fontSize: 13 }}>{props.label}</span>
        </label>
      );
    case "checkboxgroup":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(props.options || []).map((o, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: "#1e293b", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" style={{ accentColor: "#3b9eff" }} /> {o}
            </label>
          ))}
        </div>
      );
    case "select":
      return <select style={inputStyle}>{(props.options || []).map((o, i) => <option key={i}>{o}</option>)}</select>;
    case "attachment":
      return <div style={{ ...inputStyle, border: "1px dashed #d1d5db", color: "#6b7280", padding: "12px 10px", textAlign: "center" }}>📎 Click or drag to attach files</div>;
    case "textlist":
      return <input placeholder="Add item..." style={inputStyle} />;
    default:
      return <input style={inputStyle} />;
  }
}

// ─── SidebarItem ──────────────────────────────────────────────────────────────
function SidebarItem({ item }: { item: SidebarItemData }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${item.type}`,
    data: { kind: "sidebar", type: item.type, label: item.label },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 5, cursor: "grab", color: isDragging ? "#3b9eff" : "#475569", background: isDragging ? "#e2e8f0" : "transparent", fontSize: 13, userSelect: "none", transition: "all 0.15s", opacity: isDragging ? 0.5 : 1 }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = "#f0f4f8"; e.currentTarget.style.color = "#1e293b"; }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = isDragging ? "#e2e8f0" : "transparent"; e.currentTarget.style.color = isDragging ? "#3b9eff" : "#475569"; }}
    >
      <Icon d={icons[item.icon]} size={14} />
      {item.label}
    </div>
  );
}

// ─── ComponentSidebar ─────────────────────────────────────────────────────────
function ComponentSidebar({ search, onSearchChange }: { search: string; onSearchChange: (v: string) => void }) {
  const filteredGroups = SIDEBAR_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) })).filter((g) => g.items.length > 0);
  return (
    <div style={{ width: 200, background: "#ffffff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
      <div style={{ padding: "10px 10px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#e8edf3", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px" }}>
          <Icon d={icons.search} size={13} />
          <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)} placeholder="Search" style={{ background: "transparent", border: "none", color: "#1e293b", fontSize: 13, outline: "none", width: "100%" }} />
        </div>
      </div>
      {filteredGroups.map((group) => (
        <div key={group.label}>
          <div style={{ padding: "10px 10px 4px", fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{group.label}</div>
          {group.items.map((item) => <SidebarItem key={item.type} item={item} />)}
        </div>
      ))}
    </div>
  );
}

// ─── FormField — mỗi ô có grip handle bên trái ────────────────────────────────
interface FormFieldProps {
  field: Field;
  isSelected: boolean;
  isDraggingFromSidebar: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}

function FormField({ field, isSelected, isDraggingFromSidebar, onClick, onDelete }: FormFieldProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({
    id: `field:${field.id}`,
    data: { kind: "field", fieldId: field.id },
    disabled: isDraggingFromSidebar,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.3 : 1,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} onClick={onClick}>
      <div
        style={{
          border: isSelected ? "1.5px solid #3b9eff" : "1.5px solid transparent",
          borderRadius: 6,
          background: isSelected ? "rgba(59,130,246,0.04)" : "transparent",
          padding: "10px 36px 10px 30px", // left padding cho grip, right padding cho trash
          position: "relative",
          transition: "border-color 0.15s, background 0.15s",
          marginBottom: 2,
          cursor: "default",
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!isSelected) e.currentTarget.style.borderColor = "#93afc7";
          // Hiện grip và trash khi hover
          const grip = e.currentTarget.querySelector<HTMLElement>(".field-grip");
          const trash = e.currentTarget.querySelector<HTMLElement>(".field-trash");
          if (grip) grip.style.opacity = "1";
          if (trash) trash.style.opacity = "1";
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!isSelected) e.currentTarget.style.borderColor = "transparent";
          if (!isSelected) {
            const grip = e.currentTarget.querySelector<HTMLElement>(".field-grip");
            const trash = e.currentTarget.querySelector<HTMLElement>(".field-trash");
            if (grip) grip.style.opacity = "0";
            if (trash) trash.style.opacity = "0";
          }
        }}
      >
        {/* ── Grip handle bên trái ── */}
        {!isDraggingFromSidebar && (
          <div
            className="field-grip"
            {...listeners}
            {...attributes}
            title="Kéo để di chuyển"
            style={{
              position: "absolute",
              left: 6,
              top: "50%",
              transform: "translateY(-50%)",
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDragging ? "#3b9eff" : "#94a3b8",
              cursor: isDragging ? "grabbing" : "grab",
              opacity: isSelected ? 1 : 0,
              transition: "opacity 0.15s, color 0.15s",
              zIndex: 2,
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.color = "#3b9eff"; }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { if (!isDragging) e.currentTarget.style.color = "#94a3b8"; }}
            onClick={(e) => e.stopPropagation()}
          >
            <GripDots size={14} color="currentColor" />
          </div>
        )}

        {/* ── Trash button bên phải ── */}
        <button
          className="field-trash"
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onDelete(field.id); }}
          style={{ position: "absolute", right: 8, top: 8, background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 4, color: "#ef4444", cursor: "pointer", padding: "3px 5px", display: "flex", alignItems: "center", opacity: isSelected ? 1 : 0, transition: "opacity 0.15s" }}
        >
          <Icon d={icons.trash} size={12} />
        </button>

        {/* ── Label ── */}
        {field.type !== "checkbox" && (
          <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{field.props.label}</span>
            {field.props.required && <span style={{ color: "#ef4444", fontSize: 12 }}>*</span>}
          </div>
        )}

        {/* ── Field input ── */}
        {renderField(field.type, field.props)}
      </div>
    </div>
  );
}

// ─── PropertiesPanel ──────────────────────────────────────────────────────────
const propInputStyle: React.CSSProperties = { width: "90%", background: "#f5f5f5", border: "1px solid #d1d5db", color: "#1e293b", borderRadius: 4, padding: "5px 8px", fontSize: 12, outline: "none" };

function PropRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, display: "flex", gap: 4, alignItems: "center" }}>{label}{required && <span style={{ color: "#ef4444" }}>*</span>}</div>
      {children}
    </div>
  );
}

function PropertiesPanel({ field, onChange }: { field: Field | null; onChange: (props: FieldProps) => void }) {
  if (!field) return <div style={{ padding: "20px 16px", color: "#64748b", fontSize: 13, textAlign: "center" }}><div style={{ marginBottom: 8 }}>Select a field to edit</div><div style={{ fontSize: 11 }}>Properties will appear here</div></div>;
  const update = (key: keyof FieldProps, val: FieldProps[keyof FieldProps]) => onChange({ ...field.props, [key]: val });
  const hasPlaceholder = (["text", "number", "decimal", "email", "multiline", "textlist"] as FieldType[]).includes(field.type);
  const hasOptions = (["radio", "checkboxgroup", "select"] as FieldType[]).includes(field.type);
  return (
    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{field.type.charAt(0).toUpperCase() + field.type.slice(1)} — General</div>
      <PropRow label="ID" required><span style={{ color: "#6b7280", fontSize: 12 }}>{field.id}</span></PropRow>
      <PropRow label="Label"><input value={field.props.label || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("label", e.target.value)} style={propInputStyle} /></PropRow>
      <PropRow label="Required">
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={!!field.props.required} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("required", e.target.checked)} style={{ accentColor: "#3b9eff" }} />
          <span style={{ fontSize: 12, color: "#475569" }}>{field.props.required ? "Yes" : "No"}</span>
        </label>
      </PropRow>
      {hasPlaceholder && <PropRow label="Placeholder"><input value={field.props.placeholder || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("placeholder", e.target.value)} style={propInputStyle} /></PropRow>}
      {hasOptions && (
        <PropRow label="Options">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(field.props.options || []).map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 4 }}>
                <input value={opt} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const opts = [...(field.props.options ?? [])]; opts[i] = e.target.value; update("options", opts); }} style={{ flex: 1, ...propInputStyle, width: "auto" }} />
                <button onClick={() => update("options", (field.props.options ?? []).filter((_, j) => j !== i))} style={{ background: "transparent", border: "1px solid #d1d5db", color: "#ef4444", borderRadius: 4, cursor: "pointer", padding: "0 6px", fontSize: 12 }}>×</button>
              </div>
            ))}
            <button onClick={() => update("options", [...(field.props.options || []), `Option ${(field.props.options?.length || 0) + 1}`])} style={{ background: "#f0f4f8", border: "1px dashed #93c5fd", color: "#2563eb", borderRadius: 4, cursor: "pointer", padding: "4px", fontSize: 12, marginTop: 2 }}>+ Add option</button>
          </div>
        </PropRow>
      )}
      {field.type === "slider" && (
        <>
          <PropRow label="Min"><input type="number" value={field.props.min ?? 0} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("min", +e.target.value)} style={propInputStyle} /></PropRow>
          <PropRow label="Max"><input type="number" value={field.props.max ?? 100} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("max", +e.target.value)} style={propInputStyle} /></PropRow>
        </>
      )}
    </div>
  );
}

// ─── DroppableCell ────────────────────────────────────────────────────────────
function DroppableCell({ droppableId, isHighlighted, isEmpty, children, flexValue }: {
  droppableId: string; isHighlighted: boolean; isEmpty: boolean; children?: React.ReactNode; flexValue: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  const active = isOver || isHighlighted;
  return (
    <div ref={setNodeRef} style={{ flex: flexValue, minHeight: isEmpty ? 72 : undefined, borderRadius: 6, border: active ? "2px dashed #3b9eff" : isEmpty ? "2px dashed #1e2d42" : "2px solid transparent", background: active ? "rgba(59,130,246,0.07)" : "transparent", transition: "border-color 0.15s, background 0.15s", display: "flex", alignItems: "stretch", position: "relative", overflow: "hidden", minWidth: 0 }}>
      {isEmpty && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: active ? "#3b9eff" : "#94a3b8", fontSize: 11, pointerEvents: "none" }}>{active ? "Thả vào đây" : "ô trống"}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ─── ResizeHandle ─────────────────────────────────────────────────────────────
// handleIndex: 0 = between col0 & col1, 1 = between col1 & col2
// onResize receives new colWidths array
function ResizeHandle({ handleIndex, colWidths, onResize }: {
  handleIndex: number;
  colWidths: number[];
  onResize: (newWidths: number[]) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const row = (e.currentTarget as HTMLElement).closest("[data-resize-row]") as HTMLElement | null;
    if (!row) return;

    // Snapshot widths at drag start
    const startWidths = [...colWidths];
    const MIN_FRAC = 0.1; // minimum 10% per column

    const onMove = (mv: MouseEvent) => {
      const rect = row.getBoundingClientRect();
      const rowW = rect.width;
      if (rowW === 0) return;

      // Mouse position as fraction of row width
      const mouseX = (mv.clientX - rect.left) / rowW;

      // The handle sits between col[handleIndex] and col[handleIndex+1].
      // Compute the left edge of the handle's left column.
      let leftEdge = 0;
      for (let i = 0; i < handleIndex; i++) leftEdge += startWidths[i];

      // Desired width of left col = mouseX - leftEdge
      let newLeft = mouseX - leftEdge;

      // Right col gets whatever was left between these two cols
      const combined = startWidths[handleIndex] + startWidths[handleIndex + 1];
      let newRight = combined - newLeft;

      // Clamp so neither col goes below MIN_FRAC
      if (newLeft < MIN_FRAC) { newLeft = MIN_FRAC; newRight = combined - MIN_FRAC; }
      if (newRight < MIN_FRAC) { newRight = MIN_FRAC; newLeft = combined - MIN_FRAC; }

      const newWidths = [...startWidths];
      newWidths[handleIndex] = newLeft;
      newWidths[handleIndex + 1] = newRight;
      onResize(newWidths);
    };

    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      title="Kéo để thay đổi kích thước cột"
      style={{ width: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "col-resize", position: "relative", zIndex: 10, userSelect: "none" }}
    >
      <div style={{ width: dragging ? 3 : 2, height: "60%", minHeight: 24, borderRadius: 99, background: dragging ? "#3b9eff" : "#93afc7", transition: "background 0.15s, width 0.1s" }} />
      <div style={{ position: "absolute", inset: "0 -4px", cursor: "col-resize" }} onMouseDown={handleMouseDown} />
    </div>
  );
}

// ─── GridRow ──────────────────────────────────────────────────────────────────
const SLOTS: GridSlot[] = ["col0", "col1", "col2"];

function GridRow({ row, selectedId, dropTarget, isDraggingFromSidebar, onSelectField, onDeleteField, onResizeRow }: {
  row: Row; selectedId: string | null; dropTarget: DropTarget | null;
  isDraggingFromSidebar: boolean;
  onSelectField: (id: string) => void; onDeleteField: (id: string) => void;
  onResizeRow: (rowId: string, newWidths: number[]) => void;
}) {
  const isFull = row.cells.length === 1 && row.cells[0].slot === "full";
  const colCount = isFull ? 1 : row.cells.length;

  // Build slot→cell map
  const cellBySlot: Partial<Record<GridSlot, RowField>> = {};
  for (const c of row.cells) cellBySlot[c.slot] = c;

  // Helper: slot drop ID
  const dropId = (slot: GridSlot) => `${row.id}:${slot}`;
  const isTarget = (slot: GridSlot) => dropTarget?.rowId === row.id && dropTarget?.slot === slot;

  // colWidths for rendering (normalised)
  const widths = row.colWidths;

  // When dragging from sidebar and row is full, show 3 empty targets flanking the full cell
  if (isDraggingFromSidebar && isFull) {
    const fullCell = cellBySlot["full"];
    return (
      <div data-resize-row style={{ display: "flex", gap: 0, marginBottom: 8, alignItems: "stretch" }}>
        <DroppableCell droppableId={dropId("col0")} isHighlighted={isTarget("col0")} isEmpty flexValue="1 1 0%" />
        <DroppableCell droppableId={dropId("full")} isHighlighted={isTarget("full")} isEmpty={false} flexValue="2 1 0%">
          {fullCell && <FormField field={fullCell.field} isSelected={selectedId === fullCell.field.id} isDraggingFromSidebar={isDraggingFromSidebar} onClick={() => onSelectField(fullCell.field.id)} onDelete={onDeleteField} />}
        </DroppableCell>
        <DroppableCell droppableId={dropId("col1")} isHighlighted={isTarget("col1")} isEmpty flexValue="1 1 0%" />
        <DroppableCell droppableId={dropId("col2")} isHighlighted={isTarget("col2")} isEmpty flexValue="1 1 0%" />
      </div>
    );
  }

  if (isFull) {
    const fullCell = cellBySlot["full"];
    return (
      <div data-resize-row style={{ display: "flex", gap: 0, marginBottom: 8, alignItems: "stretch" }}>
        <DroppableCell droppableId={dropId("full")} isHighlighted={isTarget("full")} isEmpty={false} flexValue="1 1 100%">
          {fullCell && <FormField field={fullCell.field} isSelected={selectedId === fullCell.field.id} isDraggingFromSidebar={isDraggingFromSidebar} onClick={() => onSelectField(fullCell.field.id)} onDelete={onDeleteField} />}
        </DroppableCell>
      </div>
    );
  }

  // Multi-col row: render occupied cols + resize handles + empty drop targets for remaining slots
  // Slots in order: col0, col1, col2 (only show up to colCount + 1 if dragging)
  const occupiedSlots = row.cells.map(c => c.slot) as GridSlot[];

  // Which slots to show: always show occupied ones; if dragging show next empty slot too
  const maxSlots = isDraggingFromSidebar && colCount < 3 ? colCount + 1 : colCount;
  const displaySlots = SLOTS.slice(0, maxSlots);

  return (
    <div data-resize-row style={{ display: "flex", gap: 0, marginBottom: 8, alignItems: "stretch" }}>
      {displaySlots.map((slot, i) => {
        const cell = cellBySlot[slot];
        const isEmpty = !cell;
        // flex value: use colWidths if within range, else equal share
        const fw = widths[i] !== undefined ? `${widths[i]} 1 0%` : `1 1 0%`;
        return (
          <React.Fragment key={slot}>
            {i > 0 && occupiedSlots.includes(SLOTS[i - 1]) && (occupiedSlots.includes(slot) || isEmpty) && (
              <ResizeHandle
                handleIndex={i - 1}
                colWidths={widths}
                onResize={(nw) => onResizeRow(row.id, nw)}
              />
            )}
            <DroppableCell droppableId={dropId(slot)} isHighlighted={isTarget(slot)} isEmpty={isEmpty} flexValue={fw}>
              {cell && <FormField field={cell.field} isSelected={selectedId === cell.field.id} isDraggingFromSidebar={isDraggingFromSidebar} onClick={() => onSelectField(cell.field.id)} onDelete={onDeleteField} />}
            </DroppableCell>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── BottomDropZone ───────────────────────────────────────────────────────────
function BottomDropZone({ isEmpty, isDraggingFromSidebar }: { isEmpty: boolean; isDraggingFromSidebar: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: "canvas:new:full" });
  if (!isDraggingFromSidebar && !isEmpty) return null;
  return (
    <div ref={setNodeRef} style={{ minHeight: isEmpty ? 280 : 56, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, border: `2px dashed ${isOver ? "#3b9eff" : "#cbd5e1"}`, background: isOver ? "rgba(59,130,246,0.05)" : "transparent", transition: "all 0.2s", marginTop: isEmpty ? 0 : 4 }}>
      {isEmpty ? (
        <div style={{ textAlign: "center", color: isOver ? "#3b9eff" : "#94a3b8" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Thả component vào đây</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Thả vào giữa → cả dòng · Thả vào ô bên cạnh → nửa dòng</div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: isOver ? "#3b9eff" : "#94a3b8" }}>{isOver ? "Thêm dòng mới" : "+ Thả để thêm dòng mới"}</div>
      )}
    </div>
  );
}

// ─── FormCanvas ───────────────────────────────────────────────────────────────
function FormCanvas({ rows, selectedId, dropTarget, isDraggingFromSidebar, onSelectField, onDeleteField, onResizeRow }: {
  rows: Row[]; selectedId: string | null; dropTarget: DropTarget | null;
  isDraggingFromSidebar: boolean;
  onSelectField: (id: string) => void; onDeleteField: (id: string) => void;
  onResizeRow: (rowId: string, newWidths: number[]) => void;
}) {
  const allFieldSortableIds = rows.flatMap((row) => row.cells.map((c) => `field:${c.field.id}`));

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#f0f2f5", padding: "24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ background: "#fafafa", borderRadius: 10, border: "1px solid #e2e8f0", padding: "24px 28px", minHeight: 500 }}>
          <SortableContext items={allFieldSortableIds} strategy={rectSortingStrategy}>
            {rows.map((row) => (
              <GridRow key={row.id} row={row} selectedId={selectedId} dropTarget={dropTarget} isDraggingFromSidebar={isDraggingFromSidebar} onSelectField={onSelectField} onDeleteField={onDeleteField} onResizeRow={onResizeRow} />
            ))}
          </SortableContext>
          <BottomDropZone isEmpty={rows.length === 0} isDraggingFromSidebar={isDraggingFromSidebar} />
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let fieldCounter = 1;
let rowCounter = 1;
function newFieldId() { return `field_${fieldCounter++}`; }
function newRowId() { return `row_${rowCounter++}`; }

function removeField(rows: Row[], fieldId: string): Row[] {
  return rows
    .map((row) => {
      const removedIdx = row.cells.findIndex((c) => c.field.id === fieldId);
      if (removedIdx === -1) return row; // not in this row

      const newCells = row.cells.filter((c) => c.field.id !== fieldId);

      if (newCells.length === 0) return null; // remove entire row

      if (newCells.length === 1) {
        // Single cell remaining → reset to full-width
        return { ...row, cells: [{ ...newCells[0], slot: "full" as GridSlot }], colWidths: [1] };
      }

      // Multiple cells remaining: remove the width entry for the deleted slot,
      // then re-normalise so they sum to 1, and re-assign slot names by position.
      const newWidths = row.colWidths.filter((_, i) => i !== removedIdx);
      const total = newWidths.reduce((s, w) => s + w, 0);
      const normWidths = newWidths.map((w) => w / total);
      const slots: GridSlot[] = ["col0", "col1", "col2"];
      const reslottedCells = newCells.map((c, i) => ({ ...c, slot: slots[i] }));

      return { ...row, cells: reslottedCells, colWidths: normWidths };
    })
    .filter((row): row is Row => row !== null);
}

function parseDropId(id: string): { rowId: string; slot: GridSlot } | null {
  if (id === "canvas:new:full") return { rowId: "new", slot: "full" };
  const parts = id.split(":");
  if (parts.length === 2) {
    const [rowId, slotStr] = parts;
    const slot = slotStr as GridSlot;
    if (slot === "full" || slot === "col0" || slot === "col1" || slot === "col2") return { rowId, slot };
  }
  return null;
}

// Tìm field trong tất cả rows theo fieldId
function findFieldInRows(rows: Row[], fieldId: string): { rowId: string; slot: GridSlot } | null {
  for (const row of rows) {
    const cell = row.cells.find((c) => c.field.id === fieldId);
    if (cell) return { rowId: row.id, slot: cell.slot };
  }
  return null;
}

// ─── Schema Generator ─────────────────────────────────────────────────────────
function generateSchemaContent(rows: Row[]): string {
  const allFields = rows.flatMap((row) => row.cells.map((cell) => cell.field));

  const fieldType2Component: Record<FieldType, string> = {
    text: "Input", number: "NumberPicker", decimal: "NumberPicker",
    date: "DatePicker", multiline: "Input.TextArea", richtext: "RichText",
    password: "Password", attachment: "Attachment", textlist: "TextList",
    email: "Input", radio: "Radio.Group", switch: "Switch",
    slider: "Slider", checkbox: "Checkbox", checkboxgroup: "Checkbox.Group",
    select: "Select",
  };
  const fieldType2DataType: Record<FieldType, string> = {
    text: "string", number: "number", decimal: "number", date: "string",
    multiline: "string", richtext: "string", password: "string",
    attachment: "string", textlist: "array", email: "string",
    radio: "string", switch: "boolean", slider: "number",
    checkbox: "boolean", checkboxgroup: "array", select: "string",
  };

  const schemaFields = allFields
    .map((f) => {
      const component = fieldType2Component[f.type];
      const dataType = fieldType2DataType[f.type];
      const placeholder = f.props.placeholder ? `\n        "placeholder": ${JSON.stringify(f.props.placeholder)},` : "";
      return `    // id: ${f.id} | type: ${f.type} | created: ${f.createdAt}
    "${f.id}": {
      "type": "${dataType}",
      "title": ${JSON.stringify(f.props.label)},
      "x-decorator": "FormItem",
      "x-component": "${component}",
      "x-component-props": {${placeholder}
      },
      "x-decorator-props": {
        "layout": "vertical",
        "labelAlign": "left"
      },
      "required": ${f.props.required},
      "name": "${f.id}",
      "x-designable-id": "${f.id}",
      "x-index": ${allFields.indexOf(f)}
    }`;
    })
    .join(",\n");

  const exportedAt = new Date().toISOString();
  return `import { ISchema } from "@formily/react";

// Schema exported at: ${exportedAt}
// Total fields: ${allFields.length}
//
// Field summary:
${allFields.map((f) => `// - ${f.id} | ${f.type} | label: "${f.props.label}" | created: ${f.createdAt}`).join("\n")}

export const schema: ISchema = {
  "type": "object",
  "x-designable-id": "root_schema",
  "properties": {
    "root": {
      "type": "void",
      "x-component": "FormLayout",
      "x-component-props": {},
      "x-designable-id": "layout_root",
      "x-index": 0,
      "properties": {
${schemaFields}
      }
    }
  }
};
`;
}

function downloadSchemaFile(rows: Row[]) {
  const content = generateSchemaContent(rows);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schema.ts";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ rows }: { rows: Row[] }) {
  const hasFields = rows.some((r) => r.cells.length > 0);
  const [clicked, setClicked] = useState(false);

  const handleExport = () => {
    if (!hasFields) return;
    downloadSchemaFile(rows);
    setClicked(true);
    setTimeout(() => setClicked(false), 1500);
  };

  return (
    <div style={{
      height: 48, background: "#ffffff", borderBottom: "1px solid #e2e8f0",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", letterSpacing: "0.02em" }}>
        Form Builder
      </span>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
            background: "transparent", border: "1px solid #2a3a55",
            color: "#475569", cursor: "default",
          }}
        >
          {/* Copy icon */}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy schema
        </button>
        <button
          onClick={handleExport}
          disabled={!hasFields}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500,
            background: hasFields ? (clicked ? "#2563eb" : "#3b82f6") : "#e8edf3",
            border: hasFields ? "1px solid #2563eb" : "1px solid #1e2d42",
            color: hasFields ? "#fff" : "#94a3b8",
            cursor: hasFields ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            boxShadow: hasFields ? "0 1px 6px rgba(59,130,246,0.25)" : "none",
          }}
          title={hasFields ? "Download schema.ts" : "Add fields to canvas first"}
          onMouseEnter={(e) => { if (hasFields && !clicked) (e.currentTarget as HTMLButtonElement).style.background = "#2563eb"; }}
          onMouseLeave={(e) => { if (hasFields && !clicked) (e.currentTarget as HTMLButtonElement).style.background = "#3b82f6"; }}
        >
          {/* Download / Export icon */}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {clicked ? "Exported!" : "Export schema"}
        </button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ActiveItemKind | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [search, setSearch] = useState<string>("");

  const isDraggingFromSidebar = activeItem?.kind === "sidebar";

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const selectedField: Field | null = rows.flatMap((r) => r.cells.map((c) => c.field)).find((f) => f.id === selectedId) ?? null;

  // ── Drag start ───────────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as Record<string, unknown> | undefined;
    if (!data) return;
    if (data.kind === "sidebar") {
      setActiveItem({ kind: "sidebar", type: data.type as FieldType, label: data.label as string });
    } else if (data.kind === "field") {
      setActiveItem({ kind: "row", rowId: data.fieldId as string }); // reuse kind row để track
    }
  };

  // ── Drag over ────────────────────────────────────────────────────────────────
  const handleDragOver = (event: DragOverEvent) => {
    const data = event.active.data.current as Record<string, unknown> | undefined;
    const overId = event.over?.id as string | undefined;

    if (!overId) { setDropTarget(null); return; }

    if (data?.kind === "sidebar") {
      const parsed = parseDropId(overId);
      if (parsed) setDropTarget({ rowId: parsed.rowId, slot: parsed.slot });
      else setDropTarget(null);
      return;
    }

    // kéo field: cập nhật dropTarget để highlight ô đích
    if (data?.kind === "field") {
      // overId dạng "field:field_X" → tìm row+slot của field đó
      const overFieldId = (overId as string).replace("field:", "");
      const dstInfo = findFieldInRows(rows, overFieldId);
      if (dstInfo) setDropTarget({ rowId: dstInfo.rowId, slot: dstInfo.slot });
      else setDropTarget(null);
    }
  };

  // ── Drag end ─────────────────────────────────────────────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const data = active.data.current as Record<string, unknown> | undefined;

    setActiveItem(null);
    setDropTarget(null);
    if (!over) return;

    // ── Field reorder (kéo grip trên ô) ────────────────────────────────────
    if (data?.kind === "field") {
      const activeFieldSortId = active.id as string; // "field:field_X"
      const overSortId = over.id as string;           // "field:field_Y"

      if (activeFieldSortId === overSortId) return;

      const activeFieldId = activeFieldSortId.replace("field:", "");
      const overFieldId = overSortId.replace("field:", "");

      setRows((prev) => {
        // Tìm nguồn và đích
        const srcInfo = findFieldInRows(prev, activeFieldId);
        const dstInfo = findFieldInRows(prev, overFieldId);
        if (!srcInfo || !dstInfo) return prev;

        // Nếu cùng row → arrayMove trong row
        if (srcInfo.rowId === dstInfo.rowId) {
          return prev.map((row) => {
            if (row.id !== srcInfo.rowId) return row;
            const oldIdx = row.cells.findIndex((c) => c.field.id === activeFieldId);
            const newIdx = row.cells.findIndex((c) => c.field.id === overFieldId);
            if (oldIdx === -1 || newIdx === -1) return row;
            const newCells = arrayMove(row.cells, oldIdx, newIdx);
            // Re-assign slots by position
            const slots: GridSlot[] = ["col0", "col1", "col2"];
            return { ...row, cells: newCells.map((c, i) => ({ ...c, slot: slots[i] })) };
          });
        }

        // Khác row → hoán đổi vị trí giữa 2 field
        return prev.map((row) => {
          if (row.id === srcInfo.rowId) {
            return {
              ...row,
              cells: row.cells.map((c) => {
                if (c.field.id === activeFieldId) {
                  const dstRow = prev.find((r) => r.id === dstInfo.rowId);
                  const dstCell = dstRow?.cells.find((dc) => dc.field.id === overFieldId);
                  return dstCell ? { ...c, field: dstCell.field } : c;
                }
                return c;
              }),
            };
          }
          if (row.id === dstInfo.rowId) {
            return {
              ...row,
              cells: row.cells.map((c) => {
                if (c.field.id === overFieldId) {
                  const srcRow = prev.find((r) => r.id === srcInfo.rowId);
                  const srcCell = srcRow?.cells.find((sc) => sc.field.id === activeFieldId);
                  return srcCell ? { ...c, field: srcCell.field } : c;
                }
                return c;
              }),
            };
          }
          return row;
        });
      });
      return;
    }

    // ── Drop từ sidebar ──────────────────────────────────────────────────────
    if (data?.kind === "sidebar") {
      const overId = over.id as string;
      const parsed = parseDropId(overId);
      if (!parsed) return;
      const { rowId, slot } = parsed;
      const type = data.type as FieldType;
      const newField: Field = { id: newFieldId(), type, props: { ...defaultProps[type] }, createdAt: new Date().toISOString() };

      setRows((prev) => {
        // Drop onto bottom zone → new row
        if (rowId === "new") return [...prev, { id: newRowId(), cells: [{ field: newField, slot: "full" }], colWidths: [1] }];

        const targetRow = prev.find((r) => r.id === rowId);
        if (!targetRow) return prev;

        const isFull = targetRow.cells.length === 1 && targetRow.cells[0].slot === "full";
        const colCount = targetRow.cells.length;

        // Dropping onto a "full" cell of a full-row → new row
        if (slot === "full") return [...prev, { id: newRowId(), cells: [{ field: newField, slot: "full" }], colWidths: [1] }];

        if (isFull) {
          // Split full → 2 cols. New field goes into dropped slot position.
          const existingCell = targetRow.cells[0];
          if (slot === "col0") {
            // new on left, existing on right
            return prev.map((r) => r.id === rowId ? { ...r, cells: [{ field: newField, slot: "col0" }, { field: existingCell.field, slot: "col1" }], colWidths: [0.5, 0.5] } : r);
          } else {
            // col1 or col2: new on right, existing on left
            return prev.map((r) => r.id === rowId ? { ...r, cells: [{ field: existingCell.field, slot: "col0" }, { field: newField, slot: "col1" }], colWidths: [0.5, 0.5] } : r);
          }
        }

        // Row already has 2 or 3 cols
        if (colCount >= 3) {
          // Already full → new row
          return [...prev, { id: newRowId(), cells: [{ field: newField, slot: "full" }], colWidths: [1] }];
        }

        // colCount === 2: add a third column at the dropped position
        const existingCells = [...targetRow.cells]; // col0, col1
        // Determine insert index based on slot
        const insertIdx = slot === "col0" ? 0 : slot === "col1" ? 1 : 2;
        // Build new 3-cell array by inserting at insertIdx
        const newCells: RowField[] = [];
        const allSlots: GridSlot[] = ["col0", "col1", "col2"];
        let srcIdx = 0;
        for (let i = 0; i < 3; i++) {
          if (i === insertIdx) {
            newCells.push({ field: newField, slot: allSlots[i] });
          } else {
            // remap existing cell to new slot
            const ec = existingCells[srcIdx++];
            newCells.push({ ...ec, slot: allSlots[i] });
          }
        }
        return prev.map((r) => r.id === rowId ? { ...r, cells: newCells, colWidths: [1/3, 1/3, 1/3] } : r);
      });
      setSelectedId(newField.id);
    }
  };

  const deleteField = useCallback((id: string) => {
    setRows((prev) => removeField(prev, id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const updateFieldProps = useCallback((props: FieldProps) => {
    setRows((prev) => prev.map((row) => ({ ...row, cells: row.cells.map((cell) => cell.field.id === selectedId ? { ...cell, field: { ...cell.field, props } } : cell) })));
  }, [selectedId]);

  const handleResizeRow = useCallback((rowId: string, newWidths: number[]) => {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, colWidths: newWidths } : r));
  }, []);

  // Ghost preview khi drag field
  const draggingField = activeItem?.kind === "row"
    ? rows.flatMap((r) => r.cells).find((c) => c.field.id === (activeItem as { kind: "row"; rowId: string }).rowId)?.field
    : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f0f2f5", color: "#1e293b", fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif", overflow: "hidden" }}>
        <Header rows={rows} />
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <ComponentSidebar search={search} onSearchChange={setSearch} />
          <FormCanvas rows={rows} selectedId={selectedId} dropTarget={dropTarget} isDraggingFromSidebar={isDraggingFromSidebar} onSelectField={setSelectedId} onDeleteField={deleteField} onResizeRow={handleResizeRow} />
          <div style={{ width: 240, background: "#ffffff", borderLeft: "1px solid #e2e8f0", overflowY: "auto", flexShrink: 0 }}>
            <PropertiesPanel field={selectedField} onChange={updateFieldProps} />
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: "ease" }}>
        {/* Sidebar drag overlay */}
        {isDraggingFromSidebar && (
          <div style={{ background: "#eff6ff", border: "1.5px solid #3b82f6", borderRadius: 6, padding: "7px 12px", color: "#2563eb", fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
            {(activeItem as { kind: "sidebar"; label: string }).label}
          </div>
        )}
        {/* Field drag overlay */}
        {draggingField && (
          <div style={{ background: "#fafafa", border: "1.5px solid #3b82f6", borderRadius: 6, padding: "10px 14px", boxShadow: "0 12px 32px rgba(0,0,0,0.5)", pointerEvents: "none", opacity: 0.9, minWidth: 180 }}>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{draggingField.props.label}</div>
            <div style={{ height: 28, background: "#f5f5f5", borderRadius: 4, border: "1px solid #d1d5db" }} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}