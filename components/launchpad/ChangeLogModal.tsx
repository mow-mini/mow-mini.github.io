import { Modal } from "@components/launchpad/Modal";

type ChangeLogModalProps = {
  version: string;
  open: boolean;
  onClose: () => void;
};

const DEFAULT_CHANGELOG = [
  "Improved loading performance and refined the overall experience.",
  "Refreshed the interface to match the latest Launchpad styling.",
  "Fixed several minor issues reported in the previous release.",
];

export function ChangeLogModal({ version, open, onClose }: ChangeLogModalProps) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="Version changelog">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-white/10 bg-slate-950/95 p-6 text-slate-100 shadow-2xl">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-50">What&apos;s new?</h2>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Version {version}
          </p>
        </div>
        <ul className="space-y-3 text-sm text-slate-300">
          {DEFAULT_CHANGELOG.map((entry) => (
            <li key={entry} className="flex items-start gap-2">
              <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden />
              <span>{entry}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="self-end rounded-full bg-slate-200/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-slate-200/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
        >
          Got it
        </button>
      </div>
    </Modal>
  );
}
