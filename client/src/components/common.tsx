import type { ReactNode } from 'react';

/**
 * Shared state components.
 *
 * Structure and text only — no colours, no layout rules. Every element carries
 * a semantic className so the stylesheet has something to hook onto.
 */

export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <p className="state state-loading" role="status">
      {what}…
    </p>
  );
}

export function ErrorNote({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="state state-error" role="alert">
      <p>{error.message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="state state-empty">
      <p>{message}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value ?? '—'}</span>
    </div>
  );
}
