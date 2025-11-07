import {
  CONTEXT_MENU_MARGIN,
  DEFAULT_ICON,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  PAGE_SIZE_STEP,
  defaultSettings,
  defaultUserData,
} from "./constants";
import type { LaunchpadApp, LaunchpadSettings, LaunchpadUserData } from "./types";

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const numeric = Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

export function normalizePageSize(value: unknown): number {
  const fallback = defaultUserData.pageSize ?? DEFAULT_PAGE_SIZE;
  const clamped = clampNumber(value, MIN_PAGE_SIZE, MAX_PAGE_SIZE, fallback);
  const rounded = Number.isFinite(clamped) ? Math.round(clamped) : fallback;
  if (PAGE_SIZE_STEP <= 1) {
    return Math.min(Math.max(rounded, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
  }
  const stepped = Math.round(rounded / PAGE_SIZE_STEP) * PAGE_SIZE_STEP;
  return Math.min(Math.max(stepped, MIN_PAGE_SIZE), MAX_PAGE_SIZE);
}

export function sanitizeHttpUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  let trimmed = value.trim();

  if (!trimmed || /^javascript:/i.test(trimmed)) return "";

  if (/^\/\//.test(trimmed)) {
    trimmed = `https:${trimmed}`;
  } else if (!/^[a-z][a-z0-9+\-.]*:/i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}


export function sanitizeIconSource(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_ICON;
  const trimmed = value.trim();
  if (!trimmed || /^javascript:/i.test(trimmed)) return DEFAULT_ICON;
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^data:image\//i.test(trimmed) ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return DEFAULT_ICON;
}

export function sanitizeTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag ?? "").trim())
    .filter((tag) => tag.length > 0);
}

export function parseCustomTagString(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function createSlugId(prefix: string, name: string): string {
  const baseName = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const fallback = `${prefix}-${Date.now().toString(36)}`;
  return baseName ? `${prefix}-${baseName}` : fallback;
}

type RawApp = Partial<LaunchpadApp> & {
  tags?: unknown;
  url?: unknown;
  icon?: unknown;
};

export function sanitizeAppRecord(
  app: unknown,
  origin: LaunchpadApp["origin"]
): LaunchpadApp | null {
  if (!app || typeof app !== "object") return null;
  const raw = app as RawApp;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const description =
    typeof raw.description === "string" ? raw.description.trim() : "";
  const url = sanitizeHttpUrl(raw.url);
  const icon = sanitizeIconSource(raw.icon);
  const tags = sanitizeTagList(raw.tags);
  const id = typeof raw.id === "string" ? raw.id.trim() : "";

  if (origin === "custom" && (!name || !url)) {
    return null;
  }

  return {
    id,
    name: name || "Untitled app",
    description,
    url,
    icon,
    tags,
    origin,
  };
}

export function ensureUniqueAppIds(apps: LaunchpadApp[]): LaunchpadApp[] {
  const seen = new Set<string>();
  return apps.map((app) => {
    let baseId =
      typeof app.id === "string" && app.id.trim().length > 0
        ? app.id.trim()
        : createSlugId(app.origin === "custom" ? "custom" : "app", app.name);
    let uniqueId = baseId;
    let counter = 2;
    while (seen.has(uniqueId)) {
      uniqueId = `${baseId}-${counter}`;
      counter += 1;
    }
    seen.add(uniqueId);
    return { ...app, id: uniqueId };
  });
}

export function stripAppForStorage(app: LaunchpadApp): LaunchpadApp {
  const { origin, ...rest } = app;
  return {
    ...rest,
    origin: "custom",
  };
}

export function dedupeHiddenIds(
  hiddenIds: unknown,
  apps: LaunchpadApp[]
): string[] {
  if (!Array.isArray(hiddenIds)) return [];
  const validIds = new Set(apps.map((app) => app.id));
  return hiddenIds
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0 && validIds.has(id));
}

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: unknown): RGB | null {
  if (typeof hex !== "string") return null;
  const trimmed = hex.trim();
  if (!trimmed) return null;
  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const normalized =
    withoutHash.length === 3
      ? withoutHash
          .split("")
          .map((char) => char + char)
          .join("")
      : withoutHash;
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(rgb: RGB | null): string | null {
  if (!rgb) return null;
  const toHex = (component: number) =>
    component.toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function rgbToRgba(rgb: RGB | null, alpha: number): string {
  if (!rgb) return "rgba(15, 23, 42, 0.4)";
  const safeAlpha = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}

export function resolveHexColor(value: unknown, fallback: string): string {
  const rgb = hexToRgb(value);
  if (rgb) {
    return rgbToHex(rgb) ?? fallback;
  }
  const fallbackRgb = hexToRgb(fallback);
  return fallbackRgb ? rgbToHex(fallbackRgb) ?? fallback : fallback;
}

export function sanitizeBackgroundImage(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/javascript:/i.test(trimmed)) return "";
  return trimmed;
}

export function resolveIconSource(source: unknown): string {
  return sanitizeIconSource(source);
}

export function calculateContextMenuPosition(
  x: number,
  y: number,
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number }
): { left: number; top: number } {
  let left = x;
  let top = y;

  if (left + menuSize.width + CONTEXT_MENU_MARGIN > viewport.width) {
    left = viewport.width - menuSize.width - CONTEXT_MENU_MARGIN;
  }
  if (top + menuSize.height + CONTEXT_MENU_MARGIN > viewport.height) {
    top = viewport.height - menuSize.height - CONTEXT_MENU_MARGIN;
  }

  left = Math.max(CONTEXT_MENU_MARGIN, left);
  top = Math.max(CONTEXT_MENU_MARGIN, top);

  return { left, top };
}

export function updateSettingsFromForm(
  base: LaunchpadSettings,
  partial: Partial<LaunchpadSettings>
): LaunchpadSettings {
  return {
    ...base,
    ...partial,
    backgroundType: partial.backgroundType === "color" ? "color" : "image",
    backgroundColor: resolveHexColor(
      partial.backgroundColor,
      defaultSettings.backgroundColor
    ),
    backgroundImage: sanitizeBackgroundImage(partial.backgroundImage) || "",
    overlayOpacity: clampNumber(
      partial.overlayOpacity,
      0,
      0.6,
      defaultSettings.overlayOpacity
    ),
    blurStrength: clampNumber(
      partial.blurStrength,
      0,
      20,
      defaultSettings.blurStrength
    ),
    glassTintColor: resolveHexColor(
      partial.glassTintColor,
      defaultSettings.glassTintColor
    ),
    glassTintOpacity: clampNumber(
      partial.glassTintOpacity,
      0.05,
      0.95,
      defaultSettings.glassTintOpacity
    ),
    hideDefaultApps: Boolean(
      partial.hideDefaultApps ?? base.hideDefaultApps ?? defaultSettings.hideDefaultApps
    ),
    mobileLayout:
      partial.mobileLayout === "list"
        ? "list"
        : partial.mobileLayout === "grid"
          ? "grid"
          : base.mobileLayout ?? defaultSettings.mobileLayout,
  };
}

export function mergeUserData(
  base: LaunchpadUserData,
  partial: Partial<LaunchpadUserData>
): LaunchpadUserData {
  const hiddenAppIds = Array.isArray(partial.hiddenAppIds)
    ? partial.hiddenAppIds
    : base.hiddenAppIds;
  return {
    hiddenAppIds,
    customApps: Array.isArray(partial.customApps)
      ? partial.customApps
      : base.customApps,
    pageSize: normalizePageSize(
      partial.pageSize ?? base.pageSize ?? defaultUserData.pageSize
    ),
  };
}
