/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import type { LaunchpadController } from "@hooks/useLaunchpadState";
import { DEFAULT_ICON } from "@lib/constants";
import CloseIcon from "@icons/CloseIcon";
import { Modal } from "@components/launchpad/Modal";

type AddAppModalProps = {
  controller: LaunchpadController;
};

export function AddAppModal({ controller }: AddAppModalProps) {
  const [formState, setFormState] = useState({
    name: "",
    url: "",
    description: "",
    tags: "",
    iconChoice: controller.iconLibrary[0] ?? DEFAULT_ICON,
    iconCustom: "",
  });
  const [feedback, setFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const metadataRequestIdRef = useRef(0);

  const fetchTitleForUrl = useCallback(
    async (
      rawUrl: string,
      options: { shouldFillForm?: boolean } = {}
    ): Promise<string> => {
      const trimmedUrl = rawUrl.trim();
      if (!trimmedUrl) return "";

      const requestId = ++metadataRequestIdRef.current;
      setIsFetchingTitle(true);

      try {
        const response = await fetch(
          `/api/url-metadata?url=${encodeURIComponent(trimmedUrl)}`
        );
        if (!response.ok) {
          return "";
        }
        const data: { title?: string } = await response.json();
        const resolvedTitle =
          typeof data.title === "string" ? data.title.trim() : "";

        if (
          resolvedTitle &&
          options.shouldFillForm &&
          metadataRequestIdRef.current === requestId
        ) {
          setFormState((prev) =>
            prev.name.trim() ? prev : { ...prev, name: resolvedTitle }
          );
        }

        return resolvedTitle;
      } catch {
        return "";
      } finally {
        if (metadataRequestIdRef.current === requestId) {
          setIsFetchingTitle(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!controller.modals.addApp) return;
    const editing = controller.editingApp;
    if (editing && editing.origin === "custom") {
      setFormState({
        name: editing.name,
        url: editing.url ?? "",
        description: editing.description ?? "",
        tags: Array.isArray(editing.tags) ? editing.tags.join(", ") : "",
        iconChoice: controller.iconLibrary.includes(editing.icon)
          ? editing.icon
          : "custom",
        iconCustom: controller.iconLibrary.includes(editing.icon)
          ? ""
          : editing.icon,
      });
    } else {
      setFormState({
        name: "",
        url: "",
        description: "",
        tags: "",
        iconChoice: controller.iconLibrary[0] ?? DEFAULT_ICON,
        iconCustom: "",
      });
    }
    setFeedback("");
    setIsSubmitting(false);
    setIsFetchingTitle(false);
    metadataRequestIdRef.current = 0;
  }, [controller.modals.addApp, controller.editingApp, controller.iconLibrary]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    setIsSubmitting(true);

    try {
      let resolvedName = formState.name.trim();
      if (!formState.url.trim()) {
        setFeedback("Please enter a URL.");
        return;
      }

      if (!resolvedName) {
        resolvedName = await fetchTitleForUrl(formState.url, {
          shouldFillForm: true,
        });
        if (!resolvedName) {
          setFeedback("Unable to detect a title. Please add one manually.");
          return;
        }
      }

      const result = controller.submitCustomApp({
        id:
          controller.editingApp?.origin === "custom"
            ? controller.editingApp.id
            : undefined,
        name: resolvedName,
        url: formState.url,
        description: formState.description,
        tagsInput: formState.tags,
        iconChoice: formState.iconChoice,
        iconCustom: formState.iconCustom,
      });

      if (!result.success) {
        setFeedback(result.message ?? "Unable to save the app.");
      } else {
        setFeedback(result.message ?? "App saved successfully.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={controller.modals.addApp}
      onClose={() => controller.closeAddApp()}
      ariaLabel="Add application"
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 text-slate-100 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {controller.editingApp
                ? `Edit “${controller.editingApp.name}”`
                : "Add application"}
            </h2>
            <p className="text-xs text-slate-400">
              Create shortcuts for the tools you use frequently.
            </p>
          </div>
          <button
            type="button"
            onClick={() => controller.closeAddApp()}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto scrollbar-hide px-6 py-6 sm:px-8">
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              URL *
            </span>
            <input
              type="string"
              required
              value={formState.url}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, url: event.target.value }))
              }
              onBlur={() => {
                if (!formState.name.trim()) {
                  void fetchTitleForUrl(formState.url, { shouldFillForm: true });
                }
              }}
              className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40 focus:outline-none focus:ring-0"
              placeholder="https://example.com"
            />
            {isFetchingTitle && (
              <p className="text-xs text-slate-400">Fetching site title…</p>
            )}
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Name
            </span>
            <input
              type="text"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, name: event.target.value }))
              }
              className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40 focus:outline-none focus:ring-0"
              placeholder="Toolbox"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Short description
            </span>
            <textarea
              rows={2}
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40 focus:outline-none focus:ring-0"
              placeholder="Optional"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Tags
            </span>
            <input
              type="text"
              value={formState.tags}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, tags: event.target.value }))
              }
              className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40 focus:outline-none focus:ring-0"
              placeholder="productivity, ai"
            />
          </label>

          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              App icon
            </span>
            <div
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
              role="listbox"
              aria-label="Preset icons"
            >
              {controller.iconLibrary.map((icon) => (
                <label
                  key={icon}
                  className={clsx(
                    "group relative flex min-w-[92px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 p-3 transition focus-within:border-sky-400 hover:border-sky-400 hover:bg-slate-900/80",
                    formState.iconChoice === icon &&
                      "border-sky-400"
                  )}
                >
                  <input
                    type="radio"
                    name="iconChoice"
                    value={icon}
                    checked={formState.iconChoice === icon}
                    onChange={() =>
                      setFormState((prev) => ({
                        ...prev,
                        iconChoice: icon,
                        iconCustom: "",
                      }))
                    }
                    className="peer sr-only text-base"
                  />
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/60 p-2">
                    <img src={icon} alt="" className="h-full w-full object-contain" />
                  </span>
                </label>
              ))}
              <label
                className={clsx(
                  "group relative flex min-w-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-transparent bg-slate-900/60 p-3 text-sm text-slate-200 transition hover:border-sky-400/30 hover:bg-slate-900/80 focus-within:border-sky-400/60",
                  formState.iconChoice === "custom" &&
                    "border-sky-400"
                )}
              >
                <input
                  type="radio"
                  name="iconChoice"
                  value="custom"
                  checked={formState.iconChoice === "custom"}
                  onChange={() =>
                    setFormState((prev) => ({ ...prev, iconChoice: "custom" }))
                  }
                  className="sr-only text-base"
                />
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  Custom icon URL
                </span>
                <input
                  type="string"
                  name="iconCustom"
                  value={formState.iconCustom}
                  onFocus={() =>
                    setFormState((prev) => ({ ...prev, iconChoice: "custom" }))
                  }
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      iconCustom: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-400/40 focus:outline-none focus:ring-0"
                  placeholder="https://example.com/icon.png"
                />
              </label>
            </div>
          </div>
          {feedback && <p className="text-xs text-emerald-400">{feedback}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/80 px-6 py-4 text-sm text-slate-300 sm:px-8">
          <button
            type="button"
            onClick={() => controller.closeAddApp()}
            className="rounded-2xl border border-white/10 bg-transparent px-5 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-gradient-to-r from-sky-400/80 via-blue-500/80 to-fuchsia-500/80 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? "Saving..."
              : controller.editingApp
                ? "Save changes"
                : "Add app"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
