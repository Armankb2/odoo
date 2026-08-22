Dayflow HRMS
Technology Stack & Architecture
Hackathon Implementation Guide
Executive Summary
This document outlines a production-ready yet hackathon-friendly tech stack for building the Dayflow Human Resource Management System. The stack prioritizes rapid development, scalability, and code maintainability while keeping deployment simple.
Frontend Stack
Framework & Core
Technology	Purpose	Version
React	UI library with component-based architecture	18.x
TypeScript	Type safety and better IDE support	Latest
Vite	Fast build tool and dev server	5.x
Tailwind CSS	Utility-first CSS framework for rapid styling	3.x
React Router	Client-side routing and navigation	6.x
State Management & API
Technology	Purpose	Version
TanStack Query (React Query)	Server state management & data fetching	5.x
Zustand	Client-side state management (auth, UI state)	Latest
Axios	HTTP client with request/response interceptors	Latest
UI Components & Form Handling
Technology	Purpose	Version
shadcn/ui	Pre-built accessible component library	Latest
React Hook Form	Performant form handling	Latest
Zod	Runtime schema validation for form data	Latest
Recharts	Charts for analytics dashboard	Latest
date-fns	Date manipulation for leave/attendance	Latest
Backend Stack
Server & API Framework
Technology	Purpose	Version
Node.js	JavaScript runtime	18.x LTS
Express.js	Lightweight web framework	4.x
TypeScript	Type safety for backend code	Latest
Nodemon	Auto-restart server during development	Latest
Authentication & Security
Technology	Purpose	Version
JWT (jsonwebtoken)	Token-based authentication	Latest
bcryptjs	Password hashing	Latest
CORS	Cross-origin request handling	Built-in Express
dotenv	Environment variable management	Latest
ORM & Database Tools
Technology	Purpose	Version
Prisma ORM	Modern database abstraction with type-safe queries	Latest
Prisma Client	Database query engine	Latest
Prisma Migrations	Database schema versioning	Built-in
Validation & Utilities
Technology	Purpose	Version
Zod	Request/response schema validation	Latest
Multer	File upload handling (profile pictures, documents)	Latest
Database
Component	Choice	Reason
Primary Database	PostgreSQL 15+	Robust, free, excellent for relational data (employees, leaves, attendance)
Local Dev	PostgreSQL via Docker	Same environment as production; easy setup with docker-compose
ORM	Prisma	Type-safe queries, auto-migrations, built-in seed support for demo data
Architecture & Deployment
Layer	Technology	Details
API Server	Node.js + Express	REST API on :5000 (or configurable port)
Frontend Server	Vite Dev Server / Production Build	React app on :5173 (dev) or static hosting
Database	PostgreSQL (Docker)	Containerized for easy local/cloud setup
File Storage	Local Disk / AWS S3 (future)	Profile pictures & documents stored locally for hackathon
Deployment	Docker + docker-compose	Single docker-compose.yml runs frontend, backend, database
Development Tools
Tool	Purpose	Usage
ESLint	Code quality & linting	npm run lint
Prettier	Code formatting	npm run format
Vitest	Unit testing framework	npm test
Git	Version control	Standard development workflow
Postman	API testing & documentation	Test backend endpoints
API Design Principles
• RESTful API design with clear resource-based endpoints
• JSON request/response format with consistent error handling
• JWT-based authentication for all protected endpoints
• Pagination support for list endpoints (employees, leave requests, attendance)
• Role-based access control (RBAC) middleware for Admin vs Employee routes
Database Schema Overview
Core Tables:
• Users (id, email, password, role, createdAt, updatedAt)
• Employees (id, userId, employeeId, name, department, position, joinDate, salary, profilePicture)
• Attendance (id, employeeId, date, checkIn, checkOut, status, remarks)
• LeaveRequests (id, employeeId, leaveType, startDate, endDate, status, remarks, approvedBy, approvedAt)
• Payroll (id, employeeId, month, salary, deductions, netSalary, status)