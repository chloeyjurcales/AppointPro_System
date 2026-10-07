import { useCallback, useEffect, useRef, useState } from 'react';
import './useConfirm.css';

// "Are you sure?" dialog. Usage:
//   const { confirm, dialog } = useConfirm();
//   if (!(await confirm({ title: 'Log out?', confirmLabel: 'Yes, Log Out' }))) return;
// and render {dialog} once in the component's JSX.

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button for destructive actions.
  danger?: boolean;
};

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const close = useCallback((answer: boolean) => {
    resolverRef.current?.(answer);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    if (!options) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [options, close]);

  const dialog = options ? (
    <div
      className="cf-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close(false);
      }}
    >
      <div
        className="cf-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cf-title"
        aria-describedby={options.message ? 'cf-message' : undefined}
      >
        <h2 id="cf-title">{options.title}</h2>
        {options.message && <p id="cf-message">{options.message}</p>}
        <div className="cf-actions">
          <button type="button" className="cf-cancel" autoFocus onClick={() => close(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            className={`cf-confirm${options.danger ? ' cf-confirm-danger' : ''}`}
            onClick={() => close(true)}
          >
            {options.confirmLabel ?? 'Yes, Continue'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}