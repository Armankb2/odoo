import { useState, type FormEvent } from 'react';
import { api, type LeaveBalance, type LeaveRequest } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/common';
import { dmy, todayKey } from '../lib/format';

interface LeaveType {
  id: number;
  name: string;
  isPaid: boolean;
  requiresAttachment: boolean;
}

/** The wireframe's "Time off Type Request" modal. */
function RequestDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: types } = useAsync(() => api.get<{ types: LeaveType[] }>('/api/leave/types'), []);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStart] = useState(todayKey());
  const [endDate, setEnd] = useState(todayKey());
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = types?.types.find((t) => String(t.id) === leaveTypeId);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // multipart only when a file is attached; the server accepts either.
      const fd = new FormData();
      fd.append('leaveTypeId', leaveTypeId);
      fd.append('startDate', startDate);
      fd.append('endDate', endDate);
      if (remarks) fd.append('remarks', remarks);
      if (file) fd.append('attachment', file);
      await api.post('/api/leave/requests', fd);
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Time off Type Request">
        <div className="dialog-header">
          <h2>Time off Type Request</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            X
          </button>
        </div>

        <form className="dialog-body" onSubmit={onSubmit}>
          <label htmlFor="leaveTypeId">Time off Type</label>
          <select
            id="leaveTypeId"
            required
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
          >
            <option value="">Select…</option>
            {types?.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <fieldset className="validity-period">
            <legend>Validity Period</legend>
            <label htmlFor="startDate">From</label>
            <input
              id="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStart(e.target.value)}
            />
            <label htmlFor="endDate">To</label>
            <input
              id="endDate"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEnd(e.target.value)}
            />
          </fieldset>

          <label htmlFor="remarks">Remarks</label>
          <textarea
            id="remarks"
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />

          {/* Shown only for types that need it — Sick Leave, per the
              wireframe's "(For sick leave certificate)" note. */}
          {selected?.requiresAttachment && (
            <>
              <label htmlFor="attachment">Attachment (for sick leave certificate)</label>
              <input
                id="attachment"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="dialog-actions">
            <button type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit'}
            </button>
            <button type="button" onClick={onClose}>
              Discard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TimeOff() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const balances = useAsync(() => api.get<{ balances: LeaveBalance[] }>('/api/leave/balance'), []);
  const requests = useAsync(
    () =>
      api.get<{ requests: LeaveRequest[] }>(
        `/api/leave/requests?scope=all&search=${encodeURIComponent(applied)}`,
      ),
    [applied],
  );

  const decide = async (id: number, what: 'approve' | 'reject') => {
    setActionError(null);
    try {
      await api.patch(`/api/leave/requests/${id}/${what}`, {});
      requests.reload();
      balances.reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const cancel = async (id: number) => {
    setActionError(null);
    try {
      await api.del(`/api/leave/requests/${id}`);
      requests.reload();
      balances.reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  return (
    <section className="time-off-page">
      <PageHeader
        title="Time Off"
        actions={
          <button type="button" onClick={() => setDialogOpen(true)}>
            NEW
          </button>
        }
      />

      {/* Balance tiles: "Paid time Off — 24 Days Available". Computed
          server-side as allocated minus approved. */}
      {balances.data && (
        <ul className="balance-tiles">
          {balances.data.balances.map((b) => (
            <li key={b.leaveTypeId} className="balance-tile">
              <span className="tile-label">{b.name}</span>
              <span className="tile-value">
                {String(b.remainingDays).padStart(2, '0')} Days Available
              </span>
              <span className="tile-detail">
                {b.usedDays} used of {b.allocatedDays}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(search.trim());
          }}
        >
          <label htmlFor="leave-search">Search</label>
          <input id="leave-search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit">Search</button>
        </form>
      )}

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {requests.loading && <Loading what="Loading requests" />}
      <ErrorNote error={requests.error} onRetry={requests.reload} />
      {requests.data && requests.data.requests.length === 0 && (
        <Empty
          message="No time off requests yet."
          action={
            <button type="button" onClick={() => setDialogOpen(true)}>
              Request time off
            </button>
          }
        />
      )}

      {requests.data && requests.data.requests.length > 0 && (
        <table className="leave-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Time off Type</th>
              <th>Days</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.data.requests.map((r) => (
              <tr key={r.id} data-status={r.status}>
                <td>
                  {r.user.firstName} {r.user.lastName}
                </td>
                <td>{dmy(r.startDate)}</td>
                <td>{dmy(r.endDate)}</td>
                <td>{r.leaveType.name}</td>
                <td>{Number(r.days)}</td>
                <td className={`leave-status leave-status-${r.status.toLowerCase()}`}>
                  {r.status}
                  {r.reviewComment ? ` — ${r.reviewComment}` : ''}
                </td>
                <td className="row-actions">
                  {r.attachmentUrl && (
                    <a href={r.attachmentUrl} target="_blank" rel="noreferrer">
                      Attachment
                    </a>
                  )}
                  {/* Approve/Reject are admin-only and only meaningful while
                      the request is still pending. */}
                  {isAdmin && r.status === 'PENDING' && (
                    <>
                      <button type="button" onClick={() => decide(r.id, 'approve')}>
                        Approve
                      </button>
                      <button type="button" onClick={() => decide(r.id, 'reject')}>
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === 'PENDING' && r.userId === user?.id && (
                    <button type="button" onClick={() => cancel(r.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialogOpen && (
        <RequestDialog
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            requests.reload();
            balances.reload();
          }}
        />
      )}
    </section>
  );
}
