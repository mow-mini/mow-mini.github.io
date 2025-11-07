import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCatalogApps } from "@lib/api";
import {
  buildHiddenAppsGroup,
  filterApps,
  getIconLibrary,
  getTotalPages,
  splitApps,
  sortAppsByName,
} from "@lib/apps";
import { DEFAULT_ICON, defaultSettings, defaultUserData } from "@lib/constants";
import {
  createSlugId,
  dedupeHiddenIds,
  ensureUniqueAppIds,
  mergeUserData,
  normalizePageSize,
  parseCustomTagString,
  sanitizeAppRecord,
  sanitizeHttpUrl,
  sanitizeIconSource,
  updateSettingsFromForm,
} from "@lib/utils";
import {
  loadSettingsFromStorage,
  loadUserDataFromStorage,
  saveSettingsToStorage,
  saveUserDataToStorage,
} from "@lib/storage";
import { APP_VERSION } from "@lib/version";
import type {
  LaunchpadApp,
  LaunchpadContextMenuState,
  LaunchpadSettings,
  LaunchpadUserData,
} from "@lib/types";

type ContextMenuSource = "grid" | "hidden";

export type LaunchpadError = {
  message: string;
};

type BackupActionResult = { success: boolean; message?: string };

type LaunchpadBackupPayload = {
  version?: unknown;
  appVersion?: unknown;
  generatedAt?: unknown;
  settings?: unknown;
  userData?: unknown;
};

const BACKUP_SCHEMA_VERSION = 1;

export type CustomAppInput = {
  id?: string;
  name: string;
  url: string;
  description?: string;
  tagsInput?: string;
  iconChoice?: string;
  iconCustom?: string;
};

export type SettingsFormInput = {
  backgroundType: "image" | "color";
  backgroundImageChoice: string;
  backgroundImageCustom?: string;
  backgroundColor: string;
  overlayOpacity: number;
  blurStrength: number;
  glassTintColor: string;
  glassTintOpacity: number;
  pageSize: number;
  hideDefaultApps: boolean;
  mobileLayout: "grid" | "list";
};

type LaunchpadModalState = {
  settings: boolean;
  addApp: boolean;
  hiddenApps: boolean;
};

type HydrationState = "pending" | "ready";

export type LaunchpadController = {
  hydration: HydrationState;
  settings: LaunchpadSettings;
  userData: LaunchpadUserData;
  catalogApps: LaunchpadApp[];
  visibleApps: LaunchpadApp[];
  hiddenApps: LaunchpadApp[];
  filteredApps: LaunchpadApp[];
  searchTerm: string;
  currentPage: number;
  totalPages: number;
  activeIndex: number;
  isLoading: boolean;
  error: LaunchpadError | null;
  modals: LaunchpadModalState;
  contextMenu: LaunchpadContextMenuState;
  editingApp: LaunchpadApp | null;
  iconLibrary: string[];
  desktopPageSize: number;
  isMobileLayout: boolean;
  setSearchTerm: (term: string) => void;
  setPage: (page: number) => void;
  setActiveIndex: (index: number) => void;
  advanceActiveIndex: (delta: number) => void;
  openApp: (app: LaunchpadApp) => void;
  openSettings: () => void;
  closeSettings: (options?: { markCompleted?: boolean }) => void;
  submitSettings: (input: SettingsFormInput) => void;
  openAddApp: (app?: LaunchpadApp | null) => void;
  closeAddApp: () => void;
  submitCustomApp: (input: CustomAppInput) => { success: boolean; message?: string };
  openHiddenApps: () => void;
  closeHiddenApps: () => void;
  hideApp: (appId: string) => void;
  showApp: (appId: string) => void;
  removeCustomApp: (appId: string) => void;
  openContextMenu: (
    app: LaunchpadApp,
    source: ContextMenuSource,
    position: { x: number; y: number }
  ) => void;
  closeContextMenu: () => void;
  resetActiveIndex: () => void;
  exportBackup: () => { success: boolean; message?: string };
  importBackup: (data: unknown) => { success: boolean; message?: string };
  setDesktopPageSize: (size: number) => void;
};

const initialContextMenu: LaunchpadContextMenuState = {
  appId: null,
  source: null,
  position: null,
};

function findAppById(apps: LaunchpadApp[], id: string | null): LaunchpadApp | null {
  if (!id) return null;
  return apps.find((app) => app.id === id) ?? null;
}

export function useLaunchpadState(isMobileLayout: boolean): LaunchpadController {
  const [hydration, setHydration] = useState<HydrationState>("pending");
  const [settings, setSettings] = useState<LaunchpadSettings>({
    ...defaultSettings,
  });
  const [userData, setUserData] = useState<LaunchpadUserData>({
    ...defaultUserData,
  });
  const [baseCatalog, setBaseCatalog] = useState<LaunchpadApp[]>([]);
  const [searchTerm, setSearchTermState] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [activeIndex, setActiveIndexState] = useState(-1);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<LaunchpadError | null>(null);
  const [modals, setModals] = useState<LaunchpadModalState>({
    settings: false,
    addApp: false,
    hiddenApps: false,
  });
  const [contextMenu, setContextMenu] =
    useState<LaunchpadContextMenuState>(initialContextMenu);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  useEffect(() => {
    setHydration("ready");
    const storedSettings = loadSettingsFromStorage();
    setSettings({
      ...storedSettings,
      hideDefaultApps:
        storedSettings.hideDefaultApps ?? defaultSettings.hideDefaultApps,
    });
    const storedUserData = loadUserDataFromStorage();
    setUserData(storedUserData);
  }, []);

  useEffect(() => {
    if (hydration !== "ready") return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const catalog = await fetchCatalogApps();
        if (cancelled) return;
        setBaseCatalog(catalog);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unknown error loading apps";
        setError({ message });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [hydration]);

  const catalogApps = useMemo(() => {
    const cataloguePart = settings.hideDefaultApps ? [] : baseCatalog;
    const allApps = [...cataloguePart, ...userData.customApps];
    const normalized = ensureUniqueAppIds(
      allApps.map((app) => ({
        ...app,
        origin: app.origin ?? "catalog",
      }))
    );
    return sortAppsByName(normalized);
  }, [baseCatalog, userData.customApps, settings.hideDefaultApps]);

  const { visible: visibleApps, hidden: hiddenApps } = useMemo(
    () => splitApps(catalogApps, userData.hiddenAppIds),
    [catalogApps, userData.hiddenAppIds]
  );

  const filteredVisibleApps = useMemo(
    () => filterApps(visibleApps, searchTerm),
    [visibleApps, searchTerm]
  );

  const filteredApps = useMemo(() => {
    if (searchTerm.trim().length === 0 && hiddenApps.length > 0) {
      return [...filteredVisibleApps, buildHiddenAppsGroup(hiddenApps.length)];
    }
    return filteredVisibleApps;
  }, [filteredVisibleApps, hiddenApps.length, searchTerm]);

  const totalPages = useMemo(
    () =>
      getTotalPages(
        filteredApps,
        isMobileLayout,
        userData.pageSize ?? defaultUserData.pageSize
      ),
    [filteredApps, isMobileLayout, userData.pageSize]
  );

  useEffect(() => {
    setCurrentPage((previous) => {
      if (isMobileLayout) return 0;
      if (previous >= totalPages) {
        return Math.max(totalPages - 1, 0);
      }
      return previous;
    });
  }, [totalPages, isMobileLayout]);

  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setActiveIndexState(-1);
      return;
    }
    if (filteredApps.length > 0) {
      setActiveIndexState(0);
    } else {
      setActiveIndexState(-1);
    }
  }, [filteredApps.length, searchTerm]);

  useEffect(() => {
    if (contextMenu.appId) {
      const stillExists =
        findAppById(catalogApps, contextMenu.appId) !== null ||
        findAppById(hiddenApps, contextMenu.appId) !== null;
      if (!stillExists) {
        setContextMenu(initialContextMenu);
      }
    }
  }, [catalogApps, hiddenApps, contextMenu.appId]);

  const iconLibrary = useMemo(
    () => getIconLibrary(catalogApps),
    [catalogApps]
  );

  const desktopPageSize = useMemo(
    () => normalizePageSize(userData.pageSize),
    [userData.pageSize]
  );

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
    setCurrentPage(0);
  }, []);

  const setPage = useCallback(
    (page: number) => {
      if (isMobileLayout) {
        setCurrentPage(0);
        return;
      }
      const clamped = Math.min(Math.max(page, 0), totalPages - 1);
      setCurrentPage(clamped);
    },
    [isMobileLayout, totalPages]
  );

  const setActiveIndex = useCallback(
    (index: number) => {
      if (!filteredApps.length) {
        setActiveIndexState(-1);
        return;
      }
      const maxIndex = filteredApps.length - 1;
      const clamped = Math.min(Math.max(index, 0), maxIndex);
      setActiveIndexState(clamped);

      if (!isMobileLayout && filteredApps.length > 0) {
        const perPage = desktopPageSize;
        const targetPage = Math.floor(clamped / perPage);
        setCurrentPage(targetPage);
      }
    },
    [filteredApps, isMobileLayout, desktopPageSize]
  );

  const advanceActiveIndex = useCallback(
    (delta: number) => {
      if (!filteredApps.length) return;
      setActiveIndexState((previous) => {
        if (previous === -1) {
          const next = delta > 0 ? 0 : filteredApps.length - 1;
          if (!isMobileLayout) {
            const perPage = desktopPageSize;
            setCurrentPage(Math.floor(next / perPage));
          }
          return next;
        }
        const nextIndex =
          (previous + delta + filteredApps.length) % filteredApps.length;
        if (!isMobileLayout) {
          const perPage = desktopPageSize;
          setCurrentPage(Math.floor(nextIndex / perPage));
        }
        return nextIndex;
      });
    },
    [filteredApps, isMobileLayout, desktopPageSize]
  );

  const setDesktopPageSize = useCallback((size: number) => {
    setUserData((prev) => {
      const normalized = normalizePageSize(size);
      if (prev.pageSize === normalized) {
        return prev;
      }
      const next = {
        ...prev,
        pageSize: normalized,
      };
      saveUserDataToStorage(next);
      return next;
    });
  }, []);

  const openApp = useCallback((app: LaunchpadApp) => {
    if (!app) return;
    if (app.type === "hidden-group") {
      setModals((prev) => ({ ...prev, hiddenApps: true }));
      return;
    }
    if (app.url) {
      window.open(app.url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const openSettings = useCallback(() => {
    setModals((prev) => ({ ...prev, settings: true }));
  }, []);

  const closeSettings = useCallback(
    (options?: { markCompleted?: boolean }) => {
      setModals((prev) => ({ ...prev, settings: false }));
      if (options?.markCompleted) {
        setSettings((prev) => {
          const next = {
            ...prev,
            hasCompletedSetup: true,
          };
          saveSettingsToStorage(next);
          return next;
        });
      }
    },
    []
  );

  const submitSettings = useCallback(
    (input: SettingsFormInput) => {
      const backgroundImage =
        input.backgroundImageChoice === "custom"
          ? input.backgroundImageCustom ?? ""
          : input.backgroundImageChoice;

      const nextSettings = updateSettingsFromForm(settings, {
        backgroundType: input.backgroundType,
        backgroundImage,
        backgroundColor: input.backgroundColor,
        overlayOpacity: input.overlayOpacity,
        blurStrength: input.blurStrength,
        glassTintColor: input.glassTintColor,
        glassTintOpacity: input.glassTintOpacity,
        hasCompletedSetup: true,
        hideDefaultApps: input.hideDefaultApps,
        mobileLayout: input.mobileLayout,
      });

      const nextPageSize = normalizePageSize(input.pageSize);

      setSettings(nextSettings);
      saveSettingsToStorage(nextSettings);

      setUserData((prev) => {
        const next = {
          ...prev,
          pageSize: nextPageSize,
        };
        saveUserDataToStorage(next);
        return next;
      });

      setCurrentPage(0);
      closeSettings({ markCompleted: true });
    },
    [settings, closeSettings]
  );

  const openAddApp = useCallback((app?: LaunchpadApp | null) => {
    if (app) {
      setEditingAppId(app.id);
    } else {
      setEditingAppId(null);
    }
    setModals((prev) => ({ ...prev, addApp: true }));
  }, []);

  const closeAddApp = useCallback(() => {
    setModals((prev) => ({ ...prev, addApp: false }));
    setEditingAppId(null);
  }, []);

  const hideApp = useCallback(
    (appId: string) => {
      if (!appId) return;
      setUserData((prev) => {
        const hiddenSet = new Set(prev.hiddenAppIds);
        hiddenSet.add(appId);
        const deduped = dedupeHiddenIds(Array.from(hiddenSet), catalogApps);
        const next = {
          ...prev,
          hiddenAppIds: deduped,
        };
        saveUserDataToStorage(next);
        return next;
      });
    },
    [catalogApps]
  );

  const showApp = useCallback(
    (appId: string) => {
      if (!appId) return;
      setUserData((prev) => {
        const hiddenSet = new Set(prev.hiddenAppIds);
        hiddenSet.delete(appId);
        const deduped = dedupeHiddenIds(Array.from(hiddenSet), catalogApps);
        const next = {
          ...prev,
          hiddenAppIds: deduped,
        };
        saveUserDataToStorage(next);
        return next;
      });
    },
    [catalogApps]
  );

  const removeCustomApp = useCallback((appId: string) => {
    setUserData((prev) => {
      const next = {
        ...prev,
        customApps: prev.customApps.filter((app) => app.id !== appId),
        hiddenAppIds: prev.hiddenAppIds.filter((id) => id !== appId),
      };
      saveUserDataToStorage(next);
      return next;
    });
  }, []);

  const submitCustomApp = useCallback(
    (input: CustomAppInput) => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return { success: false, message: "Please enter a name." };
      }

      const sanitizedUrl = sanitizeHttpUrl(input.url);
      if (!sanitizedUrl) {
        return {
          success: false,
          message: "Please enter a valid link.",
        };
      }

      let icon = DEFAULT_ICON;
      if (input.iconChoice === "custom") {
        const customValue = input.iconCustom ?? "";
        if (!customValue.trim()) {
          return {
            success: false,
            message: "Paste an icon URL or pick a preset.",
          };
        }
        icon = sanitizeIconSource(customValue);
      } else if (typeof input.iconChoice === "string") {
        icon = sanitizeIconSource(input.iconChoice);
      }

      const baseApp = sanitizeAppRecord(
        {
          id: input.id,
          name: trimmedName,
          description: input.description?.trim() ?? "",
          url: sanitizedUrl,
          icon,
          tags: input.tagsInput
            ? parseCustomTagString(input.tagsInput)
            : [],
        },
        "custom"
      );

      if (!baseApp) {
        return {
          success: false,
          message: "Unable to create the app. Please check the fields again.",
        };
      }

      setUserData((prev) => {
        const previousId = input.id?.trim() || baseApp.id;
        const reservedIds = new Set(catalogApps.map((app) => app.id));
        if (previousId) {
          reservedIds.delete(previousId);
        }

        let targetId = previousId ?? "";
        if (!targetId) {
          const baseId = createSlugId("custom", baseApp.name);
          targetId = baseId;
          let counter = 2;
          while (reservedIds.has(targetId)) {
            targetId = `${baseId}-${counter}`;
            counter += 1;
          }
        } else {
          targetId = targetId.trim();
        }

        const prepared: LaunchpadApp = {
          ...baseApp,
          id: targetId,
          origin: "custom",
        };

        const withoutPrevious = prev.customApps.filter(
          (app) => app.id !== previousId && app.id !== prepared.id
        );

        const updatedCustomApps = [...withoutPrevious, prepared];

        const nextHiddenIds = prev.hiddenAppIds.filter(
          (hiddenId) => hiddenId !== previousId && hiddenId !== prepared.id
        );

        const next = {
          ...prev,
          customApps: updatedCustomApps,
          hiddenAppIds: nextHiddenIds,
        };
        saveUserDataToStorage(next);
        return next;
      });

      setEditingAppId(null);
      setModals((prev) => ({ ...prev, addApp: false }));

      return {
        success: true,
        message: input.id ? "App updated successfully." : "App saved successfully.",
      };
    },
    [catalogApps]
  );

  const openHiddenApps = useCallback(() => {
    setModals((prev) => ({ ...prev, hiddenApps: true }));
  }, []);

  const closeHiddenApps = useCallback(() => {
    setModals((prev) => ({ ...prev, hiddenApps: false }));
  }, []);

  const openContextMenu = useCallback(
    (
      app: LaunchpadApp,
      source: ContextMenuSource,
      position: { x: number; y: number }
    ) => {
      if (app.type === "hidden-group") return;
      setContextMenu({
        appId: app.id,
        source,
        position,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(initialContextMenu);
  }, []);

  const resetActiveIndex = useCallback(() => {
    setActiveIndexState(-1);
  }, []);

  const exportBackup = useCallback((): BackupActionResult => {
    if (typeof window === "undefined") {
      return {
        success: false,
        message: "Unable to export data in the current environment.",
      };
    }
    try {
      const payload = {
        version: BACKUP_SCHEMA_VERSION,
        appVersion: APP_VERSION,
        generatedAt: new Date().toISOString(),
        settings,
        userData,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const link = document.createElement("a");
      link.href = url;
      link.download = `launchpad-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return {
        success: true,
        message: "Backup exported successfully.",
      };
    } catch (error) {
      console.warn("Failed to export backup", error);
      return {
        success: false,
        message: "Export failed. Please try again.",
      };
    }
  }, [settings, userData]);

  const importBackup = useCallback(
    (data: unknown): BackupActionResult => {
      if (!data || typeof data !== "object") {
        return {
          success: false,
          message: "The backup file is invalid.",
        };
      }

      const payload = data as LaunchpadBackupPayload;
      const rawSettings = payload.settings;
      const rawUserData = payload.userData;

      if (!rawSettings && !rawUserData) {
        return {
          success: false,
          message: "The backup file is missing required data.",
        };
      }

      let settingsUpdated = false;

      if (rawSettings && typeof rawSettings === "object") {
        const incomingSettings = rawSettings as Partial<LaunchpadSettings>;
        const sanitized = updateSettingsFromForm(defaultSettings, {
          ...defaultSettings,
          ...incomingSettings,
        });
        sanitized.hasCompletedSetup =
          typeof incomingSettings.hasCompletedSetup === "boolean"
            ? incomingSettings.hasCompletedSetup
            : settings.hasCompletedSetup ?? sanitized.hasCompletedSetup;
        setSettings(sanitized);
        saveSettingsToStorage(sanitized);
        settingsUpdated = true;
      }

      let userDataUpdated = false;

      if (rawUserData && typeof rawUserData === "object") {
        const incomingUserData = rawUserData as Partial<LaunchpadUserData> & {
          customApps?: unknown;
          hiddenAppIds?: unknown;
          pageSize?: unknown;
        };

        let sanitizedCustomApps: LaunchpadApp[] | undefined;
        if (Array.isArray(incomingUserData.customApps)) {
          sanitizedCustomApps = incomingUserData.customApps
            .map((entry) => sanitizeAppRecord(entry, "custom"))
            .filter((entry): entry is LaunchpadApp => Boolean(entry));
        }

        let sanitizedHiddenIds: string[] | undefined;
        if (Array.isArray(incomingUserData.hiddenAppIds)) {
          sanitizedHiddenIds = Array.from(
            new Set(
              incomingUserData.hiddenAppIds
                .map((id) => (typeof id === "string" ? id.trim() : ""))
                .filter((id) => id.length > 0)
            )
          );
        }

        const mergedUserData = mergeUserData(defaultUserData, {
          ...(sanitizedHiddenIds ? { hiddenAppIds: sanitizedHiddenIds } : {}),
          ...(sanitizedCustomApps ? { customApps: sanitizedCustomApps } : {}),
          ...(incomingUserData.pageSize !== undefined
            ? { pageSize: incomingUserData.pageSize }
            : {}),
        });

        setUserData(mergedUserData);
        saveUserDataToStorage(mergedUserData);
        setCurrentPage(0);
        setActiveIndexState(-1);
        userDataUpdated = true;
      }

      if (!settingsUpdated && !userDataUpdated) {
        return {
          success: false,
          message: "No changes were applied from the backup file.",
        };
      }

      return {
        success: true,
        message:
          settingsUpdated && userDataUpdated
            ? "Imported settings and app data successfully."
            : settingsUpdated
              ? "Imported settings successfully."
              : "Imported app data successfully.",
      };
    },
    [settings.hasCompletedSetup]
  );

  const editingApp = useMemo(
    () => findAppById(catalogApps, editingAppId),
    [catalogApps, editingAppId]
  );

  return {
    hydration,
    settings,
    userData,
    catalogApps,
    visibleApps,
    hiddenApps,
    filteredApps,
    searchTerm,
    currentPage,
    totalPages,
    activeIndex,
    isLoading,
    error,
    modals,
    contextMenu,
    editingApp,
    iconLibrary,
    desktopPageSize,
    isMobileLayout,
    setSearchTerm,
    setPage,
    setActiveIndex,
    advanceActiveIndex,
    openApp,
    openSettings,
    closeSettings,
    submitSettings,
    openAddApp,
    closeAddApp,
    submitCustomApp,
    openHiddenApps,
    closeHiddenApps,
    hideApp,
    showApp,
    removeCustomApp,
    openContextMenu,
    closeContextMenu,
    resetActiveIndex,
    exportBackup,
    importBackup,
    setDesktopPageSize,
  };
}
