import { useState, type ReactNode } from 'react';
import { Field } from './common';
import { dmy } from '../lib/format';
import { SalaryPanel, type SalaryBreakdown } from './SalaryPanel';
import { AvatarUploader } from './AvatarUploader';

export interface EmployeeFull {
  id: number;
  loginId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  avatarUrl: string | null;
  jobPosition: string | null;
  department: string | null;
  location: string | null;
  dateOfJoining: string;
  dateOfBirth: string | null;
  nationality: string | null;
  gender: string | null;
  maritalStatus: string | null;
  personalEmail: string | null;
  residingAddress: string | null;
  accountNumber: string | null;
  bankName: string | null;
  ifscCode: string | null;
  panNo: string | null;
  uanNo: string | null;
  empCode: string | null;
  about: string | null;
  whatILoveAboutJob: string | null;
  interestsAndHobbies: string | null;
  skills: { id: number; name: string }[];
  certifications: { id: number; name: string; issuer: string | null; year: number | null }[];
  manager: { id: number; firstName: string; lastName: string } | null;
  salaryStructure?: unknown;
  /** Computed breakdown, sent only when the viewer may see this salary. */
  salary?: SalaryBreakdown | null;
}

/**
 * Header block shown above the tabs on both the read-only and own-profile
 * views.
 *
 * `onAvatarChange` is what turns the picture into an editable one. Pass it on
 * your own profile, or on anyone's as an admin; omit it and the header stays
 * read-only. The server applies the same rule regardless of what is passed.
 */
export function ProfileHeader({
  e,
  onAvatarChange,
}: {
  e: EmployeeFull;
  onAvatarChange?: (avatarUrl: string | null) => void;
}) {
  return (
    <div className="profile-header">
      {onAvatarChange ? (
        <AvatarUploader
          userId={e.id}
          avatarUrl={e.avatarUrl}
          firstName={e.firstName}
          lastName={e.lastName}
          onChange={onAvatarChange}
        />
      ) : e.avatarUrl ? (
        <img src={e.avatarUrl} alt="" className="avatar avatar-large" />
      ) : (
        <span className="avatar avatar-large avatar-fallback">
          {e.firstName[0]}
          {e.lastName[0]}
        </span>
      )}
      <div className="profile-identity">
        <h2>
          {e.firstName} {e.lastName}
        </h2>
        <Field label="Login ID" value={e.loginId} />
        <Field label="Email" value={e.email} />
        <Field label="Mobile" value={e.mobile} />
      </div>
      <div className="profile-job">
        <Field label="Job Position" value={e.jobPosition} />
        <Field label="Department" value={e.department} />
        <Field
          label="Manager"
          value={e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '—'}
        />
        <Field label="Location" value={e.location} />
        <Field label="Date of Joining" value={dmy(e.dateOfJoining)} />
      </div>
    </div>
  );
}

/**
 * Resume / Private Info / Salary Info / Security, per the wireframe.
 *
 * Salary Info is rendered only when the server actually sent a salary
 * structure. It omits the field entirely for non-admins, so there is nothing
 * to leak — the tab simply does not exist for them.
 */
export function ProfileTabs({
  e,
  extraSecurity,
  onSalarySaved,
}: {
  e: EmployeeFull;
  extraSecurity?: ReactNode;
  onSalarySaved?: () => void;
}) {
  // The tab exists only when the server sent a salary — i.e. own record, or
  // any record for an admin. Nothing to hide, because nothing was sent.
  const tabs = ['Resume', 'Private Info', ...(e.salary ? ['Salary Info'] : []), 'Security'];
  const [active, setActive] = useState(tabs[0]);

  return (
    <div className="profile-tabs">
      <div className="tab-list" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={active === t}
            className={active === t ? 'tab tab-active' : 'tab'}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {active === 'Resume' && (
        <div className="tab-panel" role="tabpanel">
          <h3>About</h3>
          <p>{e.about ?? '—'}</p>
          <h3>What I love about my job</h3>
          <p>{e.whatILoveAboutJob ?? '—'}</p>
          <h3>My interests and hobbies</h3>
          <p>{e.interestsAndHobbies ?? '—'}</p>
          <h3>Skills</h3>
          <ul className="skill-list">
            {e.skills.length ? e.skills.map((s) => <li key={s.id}>{s.name}</li>) : <li>—</li>}
          </ul>
          <h3>Certification</h3>
          <ul className="certification-list">
            {e.certifications.length ? (
              e.certifications.map((c) => (
                <li key={c.id}>
                  {c.name}
                  {c.issuer ? ` — ${c.issuer}` : ''}
                  {c.year ? ` (${c.year})` : ''}
                </li>
              ))
            ) : (
              <li>—</li>
            )}
          </ul>
        </div>
      )}

      {active === 'Private Info' && (
        <div className="tab-panel" role="tabpanel">
          <h3>Personal</h3>
          <Field label="Date of Birth" value={dmy(e.dateOfBirth)} />
          <Field label="Nationality" value={e.nationality} />
          <Field label="Gender" value={e.gender} />
          <Field label="Marital Status" value={e.maritalStatus} />
          <Field label="Personal Email" value={e.personalEmail} />
          <Field label="Residing Address" value={e.residingAddress} />
          <h3>Bank Details</h3>
          <Field label="Account Number" value={e.accountNumber} />
          <Field label="Bank Name" value={e.bankName} />
          <Field label="IFSC Code" value={e.ifscCode} />
          <Field label="PAN No" value={e.panNo} />
          <Field label="UAN No" value={e.uanNo} />
          <Field label="Emp Code" value={e.empCode} />
        </div>
      )}

      {active === 'Salary Info' && e.salary && (
        <div className="tab-panel" role="tabpanel">
          <SalaryPanel userId={e.id} salary={e.salary} onSaved={onSalarySaved} />
        </div>
      )}

      {active === 'Security' && (
        <div className="tab-panel" role="tabpanel">
          {extraSecurity ?? <p>Password and account settings are managed by the account owner.</p>}
        </div>
      )}
    </div>
  );
}
