// ============================================================
// Visual Builder — shared types
// ============================================================

/** The action that was applied to a DOM node. */
export type DOMChangeAction =
  | 'modify'   // change text / attribute
  | 'restyle'  // change inline style(s)
  | 'hide'     // display:none
  | 'show'     // undo hide
  | 'move'     // reposition within or across parents
  | 'insert'   // add a new element
  | 'delete';  // remove element from DOM

/** A single recorded mutation — the universal format used by both editor
 *  modes AND the client-side snippet that replays them on the live store. */
export interface DOMChange {
  id: string;
  /** CSS selector that uniquely identifies the target element. */
  selector: string;
  action: DOMChangeAction;
  /** Dot-path property that was changed (e.g. "textContent", "style.color",
   *  "src"). Omitted for insert / delete / hide / show. */
  property?: string;
  oldValue?: string;
  newValue?: string;
  /** For `move`: CSS selector of the new parent + child index.
   *  For `insert`: position relative to selector ('before' | 'after' | 'prepend' | 'append'). */
  position?: {
    parentSelector?: string;
    index?: number;
    placement?: 'before' | 'after' | 'prepend' | 'append';
  };
  /** Raw HTML to insert (for `insert` action). */
  html?: string;
  /** ISO timestamp of when the change was made in the editor. */
  timestamp: string;
}

// ---- Editor chrome --------------------------------------------------

export type EditorMode = 'live' | 'canvas';

export type DevicePreview = 'mobile' | 'tablet' | 'desktop';

export const DEVICE_WIDTHS: Record<DevicePreview, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1440,
};

// ---- Element selection ----------------------------------------------

export interface ElementSelection {
  /** The unique CSS selector generated for this element. */
  selector: string;
  /** Tag name, e.g. "DIV", "IMG". */
  tagName: string;
  /** Current inner text (truncated). */
  textContent?: string;
  /** Current computed / inline styles the panel cares about. */
  styles: Record<string, string>;
  /** Current HTML attributes. */
  attributes: Record<string, string>;
  /** Outer HTML snapshot (for undo). */
  outerHTML: string;
}

// ---- Canvas section blocks ------------------------------------------

export interface SectionBlock {
  id: string;
  /** Human-readable label, e.g. "Hero", "Product Grid". */
  label: string;
  /** The original CSS selector for this section in the source HTML. */
  selector: string;
  /** Serialised outer HTML of the section. */
  html: string;
  /** Order index (used for drag-and-drop reorder). */
  order: number;
  /** Whether this was inserted from the component library. */
  isCustomComponent?: boolean;
  /** Template id if from library. */
  templateId?: string;
}

// ---- Component library ----------------------------------------------

export type ComponentCategory =
  | 'conversion'
  | 'trust'
  | 'urgency'
  | 'navigation'
  | 'content'
  | 'social-proof';

export interface ComponentProp {
  name: string;
  label: string;
  type: 'text' | 'color' | 'number' | 'select' | 'boolean' | 'url';
  defaultValue: string | number | boolean;
  options?: string[]; // for select type
}

export interface ComponentTemplate {
  id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  /** Expected conversion lift label, e.g. "+3-8%". */
  expectedLift: string;
  /** SVG or data-uri thumbnail. */
  thumbnail: string;
  /** Function that returns the final HTML given resolved props. */
  buildHTML: (props: Record<string, string | number | boolean>) => string;
  /** Default CSS to inject alongside the component. */
  defaultCSS: string;
  /** Schema of configurable props. */
  configurableProps: ComponentProp[];
}

// ---- Builder-level state --------------------------------------------

export interface BuilderState {
  mode: EditorMode;
  device: DevicePreview;
  changes: DOMChange[];
  undoStack: DOMChange[][];
  redoStack: DOMChange[][];
  selectedElement: ElementSelection | null;
  isSaving: boolean;
  isDirty: boolean;
}

// ---- Props for top-level component ----------------------------------

export interface VisualBuilderProps {
  testId: string;
  targetUrl: string;
  existingVariant?: {
    id: string;
    changes: DOMChange[];
  };
}
