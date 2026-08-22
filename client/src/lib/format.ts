/** Display formatting, kept in one place so dates and money look the same
 *  everywhere. Indian digit grouping (₹1,50,000) per the wireframe. */

export const money = (v: number | string | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
      }).format(Number(v));

export const dmy = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

/** Wall-clock time of an instant, e.g. a check-in. */
export const hhmm = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const shiftDay = (iso: string, delta: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

export const todayKey = () => new Date().toISOString().slice(0, 10);

/** Text labels, not colours — the visual treatment belongs to the stylesheet.
 *  These map to the wireframe's 🟢 present / ✈️ on leave / 🟡 absent. */
export const statusLabel = (s: 'present' | 'leave' | 'absent') =>
  s === 'present' ? 'Present' : s === 'leave' ? 'On leave' : 'Absent';

/** Legend and cell labels for the attendance calendar. Text only — the colour
 *  is the stylesheet's job, driven by the same status value. */
export const dayStatusLabel = (s: 'present' | 'absent' | 'timeoff' | 'off' | 'future') =>
  s === 'present'
    ? 'Present'
    : s === 'absent'
      ? 'Absent'
      : s === 'timeoff'
        ? 'Time off'
        : s === 'off'
          ? 'Week off'
          : 'Upcoming';
