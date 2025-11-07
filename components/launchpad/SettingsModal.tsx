import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { LaunchpadController } from "@hooks/useLaunchpadState";
import { PRESET_BACKGROUND_OPTIONS, VERSION_STORAGE_KEY } from "@lib/constants";
import CloseIcon from "@icons/CloseIcon";
import GridIcon from "@icons/GridIcon";
import ListIcon from "@icons/ListIcon";
import { Modal } from "@components/launchpad/Modal";

type SettingsModalProps = {
  controller: LaunchpadController;
};

export function SettingsModal({ controller }: SettingsModalProps) {
  const [backgroundChoice, setBackgroundChoice] = useState<string>(
    controller.settings.backgroundImage &&
      PRESET_BACKGROUND_OPTIONS.includes(controller.settings.backgroundImage)
      ? controller.settings.backgroundImage
      : controller.settings.backgroundImage
        ? "custom"
        : PRESET_BACKGROUND_OPTIONS[0]
  );
  const [customImage, setCustomImage] = useState(
    backgroundChoice === "custom" ? controller.settings.backgroundImage : ""
  );
  const [overlayOpacity, setOverlayOpacity] = useState(
    controller.settings.overlayOpacity
  );
  const [blurStrength, setBlurStrength] = useState(
    controller.settings.blurStrength
  );
  const [glassOpacity, setGlassOpacity] = useState(
    controller.settings.glassTintOpacity
  );
  const [backgroundType, setBackgroundType] = useState<
    "image" | "color"
  >(controller.settings.backgroundType);
  const [backgroundColor, setBackgroundColor] = useState(
    controller.settings.backgroundColor
  );
  const [glassTintColor, setGlassTintColor] = useState(
    controller.settings.glassTintColor
  );
  const [hideDefaultApps, setHideDefaultApps] = useState(
    controller.settings.hideDefaultApps ?? false
  );
  const [pageSize, setPageSize] = useState<number>(
    controller.desktopPageSize
  );
  const [mobileLayout, setMobileLayout] = useState(
    controller.settings.mobileLayout
  );
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    settings: controllerSettings,
    modals,
    desktopPageSize,
    isMobileLayout: controllerIsMobile,
  } = controller;

  useEffect(() => {
    if (!modals.settings) return;
    setBackgroundChoice(
      controllerSettings.backgroundImage &&
        PRESET_BACKGROUND_OPTIONS.includes(
          controllerSettings.backgroundImage
        )
        ? controllerSettings.backgroundImage
        : controllerSettings.backgroundImage
          ? "custom"
          : PRESET_BACKGROUND_OPTIONS[0]
    );
    setCustomImage(controllerSettings.backgroundImage);
    setOverlayOpacity(controllerSettings.overlayOpacity);
    setBlurStrength(controllerSettings.blurStrength);
    setGlassOpacity(controllerSettings.glassTintOpacity);
    setBackgroundType(controllerSettings.backgroundType);
    setBackgroundColor(controllerSettings.backgroundColor);
    setGlassTintColor(controllerSettings.glassTintColor);
    setPageSize(desktopPageSize);
    setHideDefaultApps(controllerSettings.hideDefaultApps ?? false);
    setMobileLayout(controllerSettings.mobileLayout);
  }, [modals.settings, controllerSettings, desktopPageSize]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    controller.submitSettings({
      backgroundType,
      backgroundImageChoice: backgroundChoice,
      backgroundImageCustom: customImage,
      backgroundColor,
      overlayOpacity,
      blurStrength,
      glassTintColor,
      glassTintOpacity: glassOpacity,
      pageSize,
      hideDefaultApps,
      mobileLayout,
    });
  };

  const handleSoftwareUpdate = async () => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(VERSION_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to clear version cache from localStorage", error);
    }

    if (typeof caches !== "undefined") {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter((key) => key.startsWith("launchpad-gallery-"))
            .map((key) => caches.delete(key))
        );
      } catch (error) {
        console.warn("Unable to clear service worker asset cache", error);
      }
    }

    if ("serviceWorker" in navigator) {
      try {
        const { serviceWorker } = navigator;
        if (!serviceWorker) {
          throw new Error("Service worker container unavailable");
        }

        const registrations = serviceWorker.getRegistrations
          ? await serviceWorker.getRegistrations()
          : serviceWorker.getRegistration
            ? await serviceWorker.getRegistration().then((registration) =>
                registration ? [registration] : []
              )
            : [];

        for (const registration of registrations) {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          await registration.update().catch(() => {
            // Ignore failed updates, reload will fetch latest assets
          });
        }
      } catch (error) {
        console.warn("Unable to refresh service worker", error);
      }
    }

    window.location.reload();
  };

  const resetBackupFeedback = useCallback(() => {
    setBackupMessage(null);
    setBackupError(null);
  }, []);

  const handleExportBackup = () => {
    resetBackupFeedback();
    const result = controller.exportBackup();
    if (result.success) {
      setBackupMessage(result.message ?? "Backup exported successfully.");
    } else {
      setBackupError(result.message ?? "Export failed. Please try again.");
    }
  };

  const handleSelectImportFile = () => {
    resetBackupFeedback();
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetBackupFeedback();
    setIsImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = controller.importBackup(parsed);
      if (result.success) {
        setBackupMessage(result.message ?? "Backup imported successfully.");
      } else {
        setBackupError(result.message ?? "Import failed. Please try again.");
      }
    } catch (error) {
      console.warn("Unable to read backup file", error);
      setBackupError("The backup file is invalid or corrupted.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (modals.settings) {
      resetBackupFeedback();
    }
  }, [modals.settings, resetBackupFeedback]);

  return (
    <Modal
      open={controller.modals.settings}
      onClose={() => controller.closeSettings()}
      ariaLabel="Settings"
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Appearance</h2>
          </div>
          <button
            type="button"
            onClick={() => controller.closeSettings()}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-8 overflow-y-auto scrollbar-hide px-6 py-6 sm:px-8">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Background mode
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-3 transition hover:border-white/20 hover:bg-slate-900/60">
                <input
                  type="radio"
                  name="backgroundType"
                  value="image"
                  checked={backgroundType === "image"}
                  onChange={() => setBackgroundType("image")}
                  className="mt-1 h-4 w-4 border-white/20 text-sky-400 focus:ring-sky-400 text-base"
                />
                <span>
                  <span className="font-medium text-slate-100">
                    Image background
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    Use stunning photography with glass overlays.
                  </span>
                </span>
              </label>
              <label className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-3 transition hover:border-white/20 hover:bg-slate-900/60">
                <input
                  type="radio"
                  name="backgroundType"
                  value="color"
                  checked={backgroundType === "color"}
                  onChange={() => setBackgroundType("color")}
                  className="mt-1 h-4 w-4 border-white/20 text-sky-400 focus:ring-sky-400 text-base"
                />
                <span>
                  <span className="font-medium text-slate-100">
                    Solid colour
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    Fill the scene with a custom shade.
                  </span>
                </span>
              </label>
            </div>
          </section>

          {backgroundType === "image" ? (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Background image
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {PRESET_BACKGROUND_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-200 transition hover:border-white/20 hover:bg-slate-900/60"
                  >
                    <input
                      type="radio"
                      name="backgroundImageChoice"
                      value={option}
                      checked={backgroundChoice === option}
                      onChange={() => setBackgroundChoice(option)}
                      className="sr-only text-base"
                    />
                    <div className="overflow-hidden rounded-xl border border-white/10">
                      <div
                        className="h-20 w-full bg-cover bg-center transition duration-200 group-checked:scale-[1.02]"
                        style={{ backgroundImage: `url(${option})` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                      <span className="font-medium text-slate-200">Preset</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        Select
                      </span>
                    </div>
                  </label>
                ))}
                <label className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-dashed border-white/20 bg-slate-900/40 p-3 text-sm text-slate-200 transition hover:border-white/40 hover:bg-slate-900/60">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Custom image URL
                  </span>
                  <input
                    type="radio"
                    name="backgroundImageChoice"
                    value="custom"
                    checked={backgroundChoice === "custom"}
                    onChange={() => setBackgroundChoice("custom")}
                    className="sr-only text-base"
                  />
                  <input
                    type="string"
                    placeholder="https://images.unsplash.com/..."
                    value={customImage}
                    onFocus={() => setBackgroundChoice("custom")}
                    onChange={(event) => setCustomImage(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40 focus:outline-none focus:ring-0"
                    disabled={backgroundChoice !== "custom"}
                  />
                </label>
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Background colour
              </h3>
              <input
                type="color"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
                className="h-12 w-24 cursor-pointer rounded-2xl border border-white/10 bg-transparent text-base"
              />
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-3">
            <SliderField
              label="Overlay opacity"
              min={0}
              max={0.6}
              step={0.01}
              value={overlayOpacity}
              onChange={setOverlayOpacity}
              display={`${Math.round(overlayOpacity * 100)}%`}
            />
            <SliderField
              label="Background blur"
              min={0}
              max={20}
              step={1}
              value={blurStrength}
              onChange={setBlurStrength}
              display={`${Math.round(blurStrength)}px`}
            />
            <SliderField
              label="Glass opacity"
              min={0.05}
              max={0.95}
              step={0.01}
              value={glassOpacity}
              onChange={setGlassOpacity}
              display={`${Math.round(glassOpacity * 100)}%`}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Glass tint colour
            </h3>
            <input
              type="color"
              value={glassTintColor}
              onChange={(event) => setGlassTintColor(event.target.value)}
              className="h-12 w-24 cursor-pointer rounded-2xl border border-white/10 bg-transparent text-base"
            />
          </section>

          {!controllerIsMobile && (
            <section className="space-y-3">
              <SliderField
                label="Desktop page size"
                min={14}
                max={56}
                step={7}
                value={pageSize}
                onChange={(value) => setPageSize(value)}
                display={`${pageSize} apps`}
              />
            </section>
          )}

          {controllerIsMobile && (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Mobile view style
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <label
                  className={clsx(
                    "group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm transition hover:border-white/20 hover:bg-slate-900/60",
                    mobileLayout === "grid" && "border-sky-400/40 bg-slate-900/70 shadow-lg"
                  )}
                >
                  <input
                    type="radio"
                    name="mobileLayout"
                    value="grid"
                    checked={mobileLayout === "grid"}
                    onChange={() => setMobileLayout("grid")}
                    className="sr-only"
                  />
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-slate-100 transition group-hover:bg-white/15">
                    <GridIcon className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium text-slate-100">Grid</span>
                  <span className="text-xs text-center text-slate-400">
                    Arrange apps in tiles.
                  </span>
                </label>
                <label
                  className={clsx(
                    "group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-sm transition hover:border-white/20 hover:bg-slate-900/60",
                    mobileLayout === "list" && "border-sky-400/40 bg-slate-900/70 shadow-lg"
                  )}
                >
                  <input
                    type="radio"
                    name="mobileLayout"
                    value="list"
                    checked={mobileLayout === "list"}
                    onChange={() => setMobileLayout("list")}
                    className="sr-only"
                  />
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-slate-100 transition group-hover:bg-white/15">
                    <ListIcon className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-medium text-slate-100">List</span>
                  <span className="text-xs text-center text-slate-400">
                    Show apps in a single column.
                  </span>
                </label>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Launchpad data
            </h3>
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4 transition hover:border-white/20 hover:bg-slate-900/60">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-white/20 text-sky-400 focus:ring-sky-400"
                checked={hideDefaultApps}
                onChange={(event) => setHideDefaultApps(event.target.checked)}
              />
              <span>
                <span className="font-medium text-slate-100">
                  Only show my custom apps
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  Hide all catalogue apps and keep only the shortcuts you&apos;ve added manually.
                </span>
              </span>
            </label>
          </section>

          <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sync data
              </h3>
              <p className="text-sm text-slate-400">
                Export a JSON backup or import one to stay in sync across devices.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 sm:w-auto"
              >
                Export data
              </button>
              <button
                type="button"
                onClick={handleSelectImportFile}
                disabled={isImporting}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isImporting ? "Importing..." : "Import data"}
              </button>
            </div>
            {(backupMessage || backupError) && (
              <p
                className={clsx(
                  "text-xs",
                  backupError ? "text-rose-300" : "text-emerald-300"
                )}
              >
                {backupError ?? backupMessage}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={handleImportFile}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Software update
                </h3>
                <p className="text-sm text-slate-400">
                  Receive the latest build. Your personal settings and app data will be preserved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSoftwareUpdate()}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 sm:w-auto"
              >
                Update Now
              </button>
            </div>
          </section>
        </div>
        <div className="flex items-center justify-center sm:justify-between border-t border-white/10 bg-slate-900/80 px-6 py-4 text-sm text-slate-300 sm:px-8">
          <div className="text-[13px] text-slate-500 hidden sm:block">
            Preferences are stored in this browser only.
          </div>
          <div className="flex gap-2 items-center justify-between w-full sm:w-auto">
            <button
              type="button"
              onClick={() => controller.closeSettings()}
              className="rounded-2xl border border-white/10 bg-transparent px-5 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-gradient-to-r from-sky-400/80 via-blue-500/80 to-fuchsia-500/80 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

type SliderFieldProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  display: string;
};

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
  display,
}: SliderFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        <span className="text-slate-200">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-sky-400 text-base"
      />
    </label>
  );
}
