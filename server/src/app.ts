import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { authRouter } from './routes/auth.routes';
import { employeeRouter } from './routes/employee.routes';
import { attendanceRouter } from './routes/attendance.routes';
import { leaveRouter } from './routes/leave.routes';
import { salaryRouter } from './routes/salary.routes';
import { errorHandler } from './middleware/errorHandler';
import { UPLOAD_DIR } from './lib/upload';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
      // Required for the auth cookie to travel cross-origin. In development
      // the Vite proxy makes requests same-origin anyway, so this only matters
      // if the client is ever served from a different host.
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/employees', employeeRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/leave', leaveRouter);
  app.use('/api/salary', salaryRouter);

  // Uploaded files. `index: false` and `dotfiles: 'deny'` so the directory is
  // never listable and dotfiles are never served.
  app.use('/uploads', express.static(UPLOAD_DIR, { index: false, dotfiles: 'deny' }));

  app.use((_req, res) =>
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint' } }),
  );

  // Last, and takes four arguments — otherwise Express never calls it.
  app.use(errorHandler);

  return app;
}
