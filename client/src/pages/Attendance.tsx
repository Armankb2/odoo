import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type AttendanceRecord } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/common';
import { dmy, hhmm, monthKey, monthLabel, shiftDay, shiftMonth, todayKey } from '../lib/format';

/** The Check In / Check Out systray. The dot's colour is the stylesheet's job;
 *  `data-state` carries the meaning. */
function CheckInWidget({ onChange }: { onChange: () => void }) {
  const { data, loading, reload } = useAsync(
    () =>
      api.get<{ checkedIn: boolean; checkIn: string | null; checkOut: string | null; completed: boolean }>(
        '/api/attendance/today',
      ),
    [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (what: 'check-in' | 'check-out') => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/attendance/${what}`);
      reload();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) return <Loading what="Loading today" />;

  const state = data.completed ? 'done' : data.checkedIn ? 'in' : 'out';

  return (
    <div className="check-in-widget" data-state={state}>
      <span className={`status-dot status-dot-${state}`} aria-hidden="true" />
      <span className="check-in-label">
        {state === 'in' && `Since ${hhmm(data.checkIn)}`}
        {state === 'out' && 'Not checked in'}
        {state === 'done' && `${hhmm(data.checkIn)} — ${hhmm(data.checkOut)}`}
      </span>

      {state === 'out' && (
        <button type="button" disabled={busy} onClick={() => act('check-in')}>
          Check IN →
        </button>
      )}
      {state === 'in' && (
        <button type="button" disabled={busy} onClick={() => act('check-out')}>
          Check Out →
        </button>
      )}
      {state === 'done' && <span className="check-in-done">Checked out for today</span>}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function MyAttendance({ userId }: { userId?: number }) {
  const [month, setMonth] = useState(monthKey());
  const path = userId ? `/api/attendance/user/${userId}` : '/api/attendance/me';
  const { data, error, loading, reload } = useAsync(
    () =>
      api.get<{
        month: string;
        records: AttendanceRecord[];
        summary: { daysPresent: number; leavesCount: number; totalWorkingDays: number };
      }>(`${path}?month=${month}`),
    [month, userId],
  );

  return (
    <>
      {!userId && <CheckInWidget onChange={reload} />}

      <div className="month-nav">
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          ←
        </button>
        <span className="month-label">{monthLabel(month)}</span>
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          →
        </button>
      </div>

      {data && (
        <ul className="summary-tiles">
          <li className="summary-tile">
            <span className="tile-value">{data.summary.daysPresent}</span>
            <span className="tile-label">Count of days present</span>
          </li>
          <li className="summary-tile">
            <span className="tile-value">{data.summary.leavesCount}</span>
            <span className="tile-label">Leaves count</span>
          </li>
          <li className="summary-tile">
            <span className="tile-value">{data.summary.totalWorkingDays}</span>
            <span className="tile-label">Total working days</span>
          </li>
        </ul>
      )}

      {loading && <Loading what="Loading attendance" />}
      <ErrorNote error={error} onRetry={reload} />
      {data && data.records.length === 0 && <Empty message="No attendance recorded this month." />}

      {data && data.records.length > 0 && (
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Work Hours</th>
              <th>Extra hours</th>
            </tr>
          </thead>
          <tbody>
            {data.records.map((r) => (
              <tr key={r.date} data-missing-checkout={r.missingCheckOut || undefined}>
                <td>{dmy(r.date)}</td>
                <td>{hhmm(r.checkIn)}</td>
                {/* Flagged rather than shown as a blank, so "forgot to check
                    out" is distinguishable from "worked nothing". */}
                <td>{r.missingCheckOut ? 'Missing' : hhmm(r.checkOut)}</td>
                <td>{r.workHours}</td>
                <td>{r.extraHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function AdminAttendance() {
  const [date, setDate] = useState(todayKey());
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const { data, error, loading, reload } = useAsync(
    () =>
      api.get<{
        date: string;
        records: {
          userId: number;
          loginId: string;
          name: string;
          checkIn: string | null;
          checkOut: string | null;
          workHours: string;
          extraHours: string;
          present: boolean;
        }[];
      }>(`/api/attendance?date=${date}&search=${encodeURIComponent(applied)}`),
    [date, applied],
  );

  return (
    <>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search.trim());
        }}
      >
        <label htmlFor="att-search">Search</label>
        <input id="att-search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit">Search</button>
      </form>

      <div className="day-nav">
        <button type="button" onClick={() => setDate((d) => shiftDay(d, -1))}>
          ←
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" onClick={() => setDate((d) => shiftDay(d, 1))}>
          →
        </button>
      </div>

      {loading && <Loading what="Loading attendance" />}
      <ErrorNote error={error} onRetry={reload} />

      {data && (
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Emp</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Work Hours</th>
              <th>Extra hours</th>
            </tr>
          </thead>
          <tbody>
            {data.records.map((r) => (
              <tr key={r.userId} data-present={r.present || undefined}>
                <td>
                  {r.name} <span className="employee-loginid">{r.loginId}</span>
                </td>
                <td>{hhmm(r.checkIn)}</td>
                <td>{hhmm(r.checkOut)}</td>
                <td>{r.workHours}</td>
                <td>{r.extraHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** Role-switched: employees get their own month, admins get the whole company
 *  for one day. Two different layouts sharing only a table. */
export function Attendance() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const userId = params.get('userId');

  // An admin arriving from an employee card sees that person's month.
  if (userId) {
    return (
      <section className="attendance-page">
        <PageHeader title="Attendance" />
        <MyAttendance userId={Number(userId)} />
      </section>
    );
  }

  return (
    <section className="attendance-page">
      <PageHeader title="Attendance" />
      {user?.role === 'ADMIN' ? <AdminAttendance /> : <MyAttendance />}
    </section>
  );
}
