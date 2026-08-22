import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { useAuth } from '../hooks/useAuth';

export interface SalaryBreakdown {
  monthlyWage: number;
  yearlyWage: number;
  workingDaysPerWeek: number;
  breakMinutes: number;
  componentTotal: number;
  components: {
    name: string;
    computationType: 'PERCENT' | 'FIXED' | 'REMAINDER';
    basis: 'WAGE' | 'BASIC' | null;
    value: number;
    amount: number;
    percentOfWage: number;
  }[];
  pf: { employee: number; employer: number; rateEmployee: number; rateEmployer: number };
  deductions: { pfEmployee: number; professionalTax: number; total: number };
  netMonthly: number;
  warnings: string[];
}

/**
 * Salary Info.
 *
 * Employees see their own, read-only. Admins additionally get a wage field
 * with live recalculation — and that preview is fetched from the server rather
 * than recomputed here, so there is exactly one implementation of the formula
 * and the figures on screen are the figures that will be saved.
 */
export function SalaryPanel({
  userId,
  salary,
  onSaved,
}: {
  userId: number;
  salary: SalaryBreakdown;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [wage, setWage] = useState(String(salary.monthlyWage));
  const [view, setView] = useState(salary);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setView(salary);
    setWage(String(salary.monthlyWage));
    setDirty(false);
  }, [salary]);

  // Debounced so typing a five-digit wage does not fire five requests.
  useEffect(() => {
    if (!isAdmin || !dirty) return;
    const n = Number(wage);
    if (!Number.isFinite(n) || n < 0) return;
    const t = setTimeout(() => {
      api
        .post<{ salary: SalaryBreakdown }>(`/api/salary/${userId}/preview`, { monthlyWage: n })
        .then((r) => setView({ ...view, ...r.salary }))
        .catch((e) => setError((e as Error).message));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wage, dirty, isAdmin, userId]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch(`/api/salary/${userId}`, { monthlyWage: Number(wage) });
      setSaved(true);
      setDirty(false);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="salary-panel">
      <div className="salary-summary">
        {isAdmin ? (
          <div className="form-row">
            <label htmlFor="monthlyWage">Month Wage</label>
            <input
              id="monthlyWage"
              type="number"
              min={0}
              step="0.01"
              value={wage}
              onChange={(e) => {
                setWage(e.target.value);
                setDirty(true);
                setSaved(false);
              }}
            />
            <button type="button" onClick={save} disabled={busy || !dirty}>
              {busy ? 'Saving…' : 'Save wage'}
            </button>
          </div>
        ) : (
          <div className="field">
            <span className="field-label">Month Wage</span>
            <span className="field-value">{money(view.monthlyWage)}</span>
          </div>
        )}

        <div className="field">
          <span className="field-label">Yearly wage</span>
          <span className="field-value">{money(view.yearlyWage)}</span>
        </div>
        <div className="field">
          <span className="field-label">No of working days in a week</span>
          <span className="field-value">{view.workingDaysPerWeek}</span>
        </div>
        <div className="field">
          <span className="field-label">Break Time</span>
          <span className="field-value">{view.breakMinutes} minutes</span>
        </div>
      </div>

      {!isAdmin && <p className="hint">Your salary details are read-only. Contact HR to make changes.</p>}
      {dirty && <p className="notice">Preview only — not saved yet.</p>}
      {saved && <p className="notice">Salary updated.</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {view.warnings.map((w) => (
        <p key={w} className="warning" role="alert">
          {w}
        </p>
      ))}

      <h3>Salary Components</h3>
      <table className="salary-components">
        <thead>
          <tr>
            <th>Component</th>
            <th>Rule</th>
            <th>Amount</th>
            <th>% of wage</th>
          </tr>
        </thead>
        <tbody>
          {view.components.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td>
                {c.computationType === 'PERCENT'
                  ? `${c.value}% of ${c.basis === 'WAGE' ? 'wage' : 'basic'}`
                  : c.computationType === 'REMAINDER'
                    ? 'wage − all other components'
                    : 'fixed amount'}
              </td>
              <td>{money(c.amount)}</td>
              <td>{c.percentOfWage}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              Total
            </th>
            <td>{money(view.componentTotal)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <h3>Provident Fund (PF) Contribution</h3>
      <table className="pf-table">
        <thead>
          <tr>
            <th />
            <th>Amount</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Employee</th>
            <td>{money(view.pf.employee)}</td>
            <td>{view.pf.rateEmployee}%</td>
          </tr>
          <tr>
            <th scope="row">Employer</th>
            <td>{money(view.pf.employer)}</td>
            <td>{view.pf.rateEmployer}%</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">PF is calculated based on the basic salary.</p>

      <h3>Tax Deductions</h3>
      <table className="deductions-table">
        <tbody>
          <tr>
            <th scope="row">Professional Tax</th>
            <td>{money(view.deductions.professionalTax)}</td>
          </tr>
          <tr>
            <th scope="row">PF (employee)</th>
            <td>{money(view.deductions.pfEmployee)}</td>
          </tr>
          <tr>
            <th scope="row">Total deductions</th>
            <td>{money(view.deductions.total)}</td>
          </tr>
          <tr>
            <th scope="row">Net monthly</th>
            <td>{money(view.netMonthly)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
