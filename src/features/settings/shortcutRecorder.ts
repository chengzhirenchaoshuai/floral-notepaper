interface ParsedShortcut {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

const KEY_DISPLAY_NAMES: Record<string, string> = {
  Control: "Ctrl",
  Meta: "Meta",
  Backspace: "←",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

const MODIFIER_ORDER = ["Control", "Alt", "Shift", "Meta"];

function parseShortcutString(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+");
  const result: ParsedShortcut = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
  for (const part of parts) {
    switch (part) {
      case "Control":
      case "Ctrl":
      case "Mod":
        result.ctrl = true;
        break;
      case "Alt":
      case "Option":
        result.alt = true;
        break;
      case "Shift":
        result.shift = true;
        break;
      case "Meta":
      case "Command":
        result.meta = true;
        break;
      default:
        result.key = part;
        break;
    }
  }
  return result;
}

export function hotkeyToConfigString(shortcut: string): string {
  const parsed = parseShortcutString(shortcut);
  const parts: string[] = [];
  if (parsed.ctrl) parts.push("Ctrl");
  if (parsed.alt) parts.push("Alt");
  if (parsed.shift) parts.push("Shift");
  if (parsed.meta) parts.push("Meta");
  parts.push(parsed.key);
  return parts.join("+");
}

export function isValidGlobalShortcut(shortcut: string): boolean {
  const parsed = parseShortcutString(shortcut);
  return parsed.ctrl || parsed.alt || parsed.meta;
}

export function formatHeldKeys(keys: string[]): string {
  const modifiers: string[] = [];
  const others: string[] = [];

  for (const key of keys) {
    if (MODIFIER_ORDER.includes(key)) {
      modifiers.push(key);
    } else {
      others.push(key);
    }
  }

  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));

  return [...modifiers, ...others].map((k) => KEY_DISPLAY_NAMES[k] ?? k).join(" + ");
}
