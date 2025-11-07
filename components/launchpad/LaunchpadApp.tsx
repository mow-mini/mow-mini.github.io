"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLaunchpadState } from "@hooks/useLaunchpadState";
import { useLaunchpadView } from "@hooks/useLaunchpadView";
import { useMediaQuery } from "@hooks/useMediaQuery";
import { MOBILE_BREAKPOINT, VERSION_STORAGE_KEY } from "@lib/constants";
import { APP_VERSION } from "@lib/version";
import { AppCard } from "@components/launchpad/AppCard";
import { ContextMenu } from "@components/launchpad/ContextMenu";
import { EmptyState } from "@components/launchpad/EmptyState";
import { ErrorBanner } from "@components/launchpad/ErrorBanner";
import { HiddenAppsModal } from "@components/launchpad/HiddenAppsModal";
import { LaunchpadHeader } from "@components/launchpad/Header";
import { LoadingOverlay } from "@components/launchpad/LoadingOverlay";
import { PaginationDots } from "@components/launchpad/PaginationDots";
import { AddAppModal } from "@components/launchpad/AddAppModal";
import { SettingsModal } from "@components/launchpad/SettingsModal";
import { VersionBadge } from "@components/launchpad/VersionBadge";
import { ChangeLogModal } from "@components/launchpad/ChangeLogModal";

export function LaunchpadApp(): JSX.Element {
  const isMobileLayout = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const controller = useLaunchpadState(isMobileLayout);

  const searchRef = useRef<HTMLInputElement>(null);
  const pagesWrapperRef = useRef<HTMLDivElement>(null);
  const gridViewportRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const {
    overlayStyle,
    glassTint,
    pages,
    handleCardContextMenu,
    handleCardPointerDown,
    handleCardPointerUp,
  } = useLaunchpadView({
    controller,
    isMobileLayout,
    searchRef,
    pagesWrapperRef,
    gridViewportRef,
    contextMenuRef,
  });

  const {
    filteredApps,
    activeIndex,
    openApp,
    setActiveIndex,
    setSearchTerm,
    searchTerm,
    currentPage,
    totalPages,
    setPage,
    desktopPageSize,
    closeContextMenu,
    contextMenu,
  } = controller;
  const desktopGridLayout = useMemo(() => {
    if (isMobileLayout) {
      return null;
    }
    const width = viewportSize.width;
    if (!width) {
      return null;
    }
    const height = viewportSize.height;
    const gap =
      width >= 1280 ? 32 : width >= 1024 ? 28 : 24;
    const minCardWidth = 160;
    const minCardHeight = 160;
    const maxColumnsByWidth = Math.max(
      1,
      Math.floor((width + gap) / (minCardWidth + gap))
    );
    let columns = Math.min(
      desktopPageSize,
      Math.max(3, Math.round(Math.sqrt(desktopPageSize))),
      maxColumnsByWidth
    );
    if (columns < 1) {
      columns = 1;
    }
    let rows = Math.ceil(desktopPageSize / columns);
    if (height) {
      const maxRowsByHeight = Math.max(
        1,
        Math.floor((height + gap) / (minCardHeight + gap))
      );
      if (rows > maxRowsByHeight) {
        rows = maxRowsByHeight;
        columns = Math.min(
          maxColumnsByWidth,
          Math.max(1, Math.ceil(desktopPageSize / rows))
        );
      }
    }
    return {
      columns,
      rows,
      gap,
      style: {
        gap: `${gap}px`,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      } as CSSProperties,
    };
  }, [desktopPageSize, isMobileLayout, viewportSize.height, viewportSize.width]);

  const isContextMenuOpen = Boolean(contextMenu.appId);
  const contextMenuTargetId = contextMenu.appId;
  const shouldDimGridCards = isContextMenuOpen && contextMenu.source === "grid";
  const isListLayout = isMobileLayout && controller.settings.mobileLayout === "list";
  const cardLayoutVariant = isListLayout ? "list" : "grid";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedVersion = window.localStorage.getItem(VERSION_STORAGE_KEY);
    if (cachedVersion !== APP_VERSION) {
      setIsChangeLogOpen(true);
    }
  }, [gridViewportRef]);

  const handleCloseChangeLog = () => {
    setIsChangeLogOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
    }
  };

  useEffect(() => {
    if (!navigator.serviceWorker) return undefined;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "app-version") return;
      const latestVersion = String(event.data.version ?? "");
      if (!latestVersion) return;
      const cached = window.localStorage.getItem(VERSION_STORAGE_KEY);
      if (cached !== latestVersion) {
        window.localStorage.setItem(VERSION_STORAGE_KEY, latestVersion);
        setIsChangeLogOpen(true);
      }
    };

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const viewport = gridViewportRef.current;
    if (!viewport) {
      return;
    }
    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      setViewportSize((prev) => {
        if (prev.width === rect.width && prev.height === rect.height) {
          return prev;
        }
        return { width: rect.width, height: rect.height };
      });
    };
    updateSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => {
        window.removeEventListener("resize", updateSize);
      };
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setViewportSize((prev) => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className="relative min-h-screen min-h-[100dvh] w-full select-none"
      suppressHydrationWarning
    >
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-500"
        style={overlayStyle}
      />

      <LoadingOverlay visible={controller.isLoading} />

      <main className="relative z-10 flex min-h-screen min-h-[100dvh] w-full flex-col items-center px-4 pb-[calc(var(--safe-area-bottom)+2rem)] pt-[calc(var(--safe-area-top)+6rem)] sm:pt-[calc(var(--safe-area-top)+4rem)]">
        <LaunchpadHeader
          searchRef={searchRef}
          defaultValue={searchTerm}
          onSearchChange={setSearchTerm}
          onOpenAddApp={controller.openAddApp}
          onOpenSettings={controller.openSettings}
          glassTint={glassTint}
        />

        {controller.error && <ErrorBanner message={controller.error.message} />}

        <section
          ref={gridViewportRef}
          className="relative pt-2 flex w-full max-w-5xl flex-1 flex-col gap-10 overflow-y-auto scrollbar-hide sm:overflow-hidden"
        >
          <div
            ref={pagesWrapperRef}
            className="flex flex-1 flex-col transition-transform duration-500 ease-out lg:flex-row"
          >
            {pages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                className={`flex w-full items-stretch ${isListLayout ? "justify-start" : "justify-center"} lg:h-full lg:shrink-0`}
              >
                <div
                  className={
                    isListLayout
                      ? "flex w-full flex-col gap-2"
                      : "grid w-full gap-8 sm:gap-6 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-7"
                  }
                  style={
                    !isListLayout && !isMobileLayout && desktopGridLayout
                      ? desktopGridLayout.style
                      : undefined
                  }
                >
                  {page.map((app, index) => {
                    const globalIndex = isMobileLayout
                      ? index
                      : pageIndex * desktopPageSize + index;
                    const isActive = activeIndex === globalIndex;
                    return (
                      <AppCard
                        key={app.id}
                        app={app}
                        isActive={isActive}
                        isDimmed={
                          shouldDimGridCards && app.id !== contextMenuTargetId
                        }
                        onClick={() => openApp(app)}
                        onDoubleClick={() => openApp(app)}
                        onContextMenu={(event) =>
                          handleCardContextMenu(event, app, "grid")
                        }
                        onPointerDown={(event) =>
                          handleCardPointerDown(event, app, "grid")
                        }
                        onPointerUp={handleCardPointerUp}
                        onFocus={() => setActiveIndex(globalIndex)}
                        glassTint={glassTint}
                        layoutVariant={cardLayoutVariant}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <PaginationDots
            currentPage={currentPage}
            totalPages={totalPages}
            onNavigate={setPage}
            hidden={isMobileLayout || totalPages <= 1}
          />

          <EmptyState visible={filteredApps.length === 0} />
        </section>
        <section>
          <VersionBadge />
        </section>
      </main>

      <SettingsModal controller={controller} />
      <AddAppModal controller={controller} />
      <HiddenAppsModal
        controller={controller}
        onContextMenu={handleCardContextMenu}
        onPointerDown={handleCardPointerDown}
        onPointerUp={handleCardPointerUp}
        glassTint={glassTint}
      />
      {isContextMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          role="presentation"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            closeContextMenu();
          }}
          onContextMenu={(event) => event.preventDefault()}
        />
      )}
      <ContextMenu controller={controller} ref={contextMenuRef} />
      <ChangeLogModal
        version={APP_VERSION}
        open={isChangeLogOpen}
        onClose={handleCloseChangeLog}
      />
    </div>
  );
}
