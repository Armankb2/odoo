import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type AttendanceDay, type AttendanceRecord } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import { Empty, ErrorNote, Loading, PageHeader } from '../components/common';
import {
  dayStatusLabel,
  dmy,
  hhmm,
  monthKey,
  monthLabel,
  shiftDay,
  shiftMonth,
  todayKey,
} from '../lib/format';

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

const WEEKDAY_HEADS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LEGEND: AttendanceDay['status'][] = ['present', 'absent', 'timeoff', 'off'];

/**
 * Month grid of the employee's attendance.
 *
 * The server decides each day's status; this only lays the days out and hands
 * the status to the stylesheet as `data-status`. Weeks start on Sunday, so the
 * grey Sunday column lines up down the left edge.
 */
function AttendanceCalendar({ month, days }: { month: string; days: AttendanceDay[] }) {
  if (days.length === 0) return null;

  // Blank cells so the 1st lands under its real weekday.
  const lead = days[0].weekday;
  const today = todayKey();

  return (
    <div className="attendance-calendar">
      <ul className="calendar-legend">
        {LEGEND.map((status) => (
          <li key={status} className="legend-item">
            <span className="legend-swatch" data-status={status} aria-hidden="true" />
            {dayStatusLabel(status)}
          </li>
        ))}
      </ul>

      <div className="calendar-grid" role="grid" aria-label={`Attendance for ${monthLabel(month)}`}>
        {WEEKDAY_HEADS.map((w) => (
          <div key={w} className="calendar-weekday" role="columnheader">
            {w}
          </div>
        ))}

        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} className="calendar-cell calendar-cell-blank" role="gridcell" />
        ))}

        {days.map((d) => (
          <div
            key={d.date}
            className="calendar-cell"
            role="gridcell"
            data-status={d.status}
            data-today={d.date === today || undefined}
            /* The colour alone is not accessible, so every cell states its
               meaning in text for a screen reader and on hover. */
            title={`${dmy(d.date)} — ${dayStatusLabel(d.status)}${
              d.workHours && d.status === 'present' ? ` (${d.workHours})` : ''
            }`}
          >
            <span className="calendar-date">{d.day}</span>
            <span className="calendar-status">{dayStatusLabel(d.status)}</span>
            {d.status === 'present' && (
              <span className="calendar-hours">
                {d.missingCheckOut ? 'No check-out' : d.workHours}
              </span>
            )}
          </div>
        ))}
      </div>
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
        days: AttendanceDay[];
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

      {/* The calendar is the view. It always renders a full month, including
          months with no attendance at all, so there is no empty state for it —
          a grid of grey and red is itself the answer. */}
      {data && <AttendanceCalendar month={data.month} days={data.days} />}

      {data && data.records.length === 0 && (
        <Empty message="No check-ins recorded this month." />
      )}

      {data && data.records.length > 0 && <h3>Day detail</h3>}
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
