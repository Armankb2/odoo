# Dayflow — Human Resource Management System

> Every workday, perfectly aligned.

Extracted from `Dayflow - Human Resource Management System.pdf` (5 pages, kept
alongside this file so the repo is self-contained).

Reference wireframes: https://link.excalidraw.com/l/65VNwvy7c4X/58RLEJ4oOwh

---

## 1. Introduction

### 1.1 Purpose

Define the functional and non-functional requirements of an HRMS. The system
digitizes and streamlines core HR operations: employee onboarding, profile
management, attendance tracking, leave management, payroll visibility, and
approval workflows for admins and HR officers.

### 1.2 Scope

- Secure authentication (Sign Up / Sign In)
- Role-based access (Admin vs Employee)
- Employee profile management
- Attendance tracking (daily / weekly view)
- Leave and time-off management
- Approval workflows for HR/Admin

### 1.3 Definitions & Abbreviations

- **Admin / HR Officer** — user with management and approval privileges
- **Employee** — regular user with limited access
- **Time-Off** — paid leave, sick leave, unpaid leave, etc.

## 2. User Classes and Characteristics

| User type | Description |
|---|---|
| Admin / HR Officer | Manages employees, approves leave & attendance, views payroll details |
| Employee | Views personal profile, attendance, applies for leave, views salary details |

## 3. Functional Requirements

### 3.1 Authentication & Authorization

**3.1.1 Sign Up** — register with Employee ID, email, password, role
(Employee / HR). Password must follow security rules. Email verification is
required.

**3.1.2 Sign In** — log in with email and password. Incorrect credentials show
error messages. Successful login redirects to the dashboard.

### 3.2 Dashboard

**3.2.1 Employee Dashboard** — quick-access cards for Profile, Attendance,
Leave Requests, Logout. Shows recent activity or alerts.

**3.2.2 Admin / HR Dashboard** — employee list, attendance records, leave
approvals. Ability to switch between employees.

### 3.3 Employee Profile Management

**3.3.1 View Profile** — personal details, job details, salary structure,
documents, profile picture.

**3.3.2 Edit Profile** — employees edit limited fields (address, phone,
profile picture). Admin can edit all employee details.

### 3.4 Attendance Management

**3.4.1 Attendance Tracking** — daily and weekly views; check-in/check-out for
employees. Status types: Present, Absent, Half-day, Leave.

**3.4.2 Attendance View** — employees see only their own attendance; Admin/HR
see all employees.

### 3.5 Leave & Time-Off Management

**3.5.1 Apply for Leave (Employee)** — select leave type (Paid, Sick, Unpaid),
choose date range, add remarks. Request status: Pending, Approved, Rejected.

**3.5.2 Leave Approval (Admin/HR)** — view all leave requests, approve or
reject, add comments. Changes reflect immediately in employee records.

### 3.6 Payroll / Salary Management

**3.6.1 Employee Payroll View** — payroll data is read-only for employees.

**3.6.2 Admin Payroll Control** — view payroll of all employees, update salary
structure, ensure payroll accuracy.

## 6. Future Enhancements

- Email & notification alerts
- Analytics & reports dashboard (salary slips, attendance reports)
