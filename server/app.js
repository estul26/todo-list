import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTodoStore } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function normalizeTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDueDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10) === trimmed ? trimmed : undefined;
}

function jsonError(res, status, error) {
  return res.status(status).json({ error });
}

const authCookieName = 'todo_auth';
const sessionMaxAgeMs = 1000 * 60 * 60 * 24 * 30;

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf('=');
        if (separator === -1) return [cookie, ''];
        return [
          decodeURIComponent(cookie.slice(0, separator)),
          decodeURIComponent(cookie.slice(separator + 1))
        ];
      })
  );
}

function signSession(timestamp, secret) {
  return crypto.createHmac('sha256', secret).update(String(timestamp)).digest('base64url');
}

function createSessionCookie(password) {
  const timestamp = Date.now();
  return `${timestamp}.${signSession(timestamp, password)}`;
}

function isValidSession(value, password) {
  if (!value || typeof value !== 'string') return false;

  const [timestamp, signature] = value.split('.');
  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > sessionMaxAgeMs) return false;

  const expected = signSession(timestamp, password);
  if (Buffer.byteLength(signature || '') !== Buffer.byteLength(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(signature || ''), Buffer.from(expected));
}

function setAuthCookie(res, value, secure) {
  const parts = [
    `${authCookieName}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}`
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${authCookieName}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`);
}

export function createApp({
  store = createTodoStore(),
  serveStatic = process.env.NODE_ENV === 'production',
  password = process.env.TODO_PASSWORD || ''
} = {}) {
  const app = express();
  const authEnabled = Boolean(password);
  const secureCookies = process.env.COOKIE_SECURE === 'true';

  app.use(express.json());

  function isAuthenticated(req) {
    if (!authEnabled) return true;
    return isValidSession(parseCookies(req.headers.cookie)[authCookieName], password);
  }

  function requireAuth(req, res, next) {
    if (isAuthenticated(req)) return next();
    return jsonError(res, 401, 'Password required.');
  }

  app.get('/api/auth/status', (req, res) => {
    res.json({ enabled: authEnabled, authenticated: isAuthenticated(req) });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!authEnabled) return res.json({ authenticated: true });
    if (typeof req.body?.password !== 'string' || req.body.password !== password) {
      return jsonError(res, 401, 'Invalid password.');
    }

    setAuthCookie(res, createSessionCookie(password), secureCookies);
    res.json({ authenticated: true });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    res.status(204).end();
  });

  app.use('/api/todos', requireAuth);

  app.get('/api/todos', (_req, res) => {
    res.json({ todos: store.list() });
  });

  app.post('/api/todos', (req, res) => {
    const title = normalizeTitle(req.body?.title);
    if (!title) return jsonError(res, 400, 'Title is required.');

    const dueDate = normalizeDueDate(req.body?.dueDate);
    if (dueDate === undefined) return jsonError(res, 400, 'Due date must be a valid date.');

    res.status(201).json({ todo: store.create(title, dueDate) });
  });

  app.patch('/api/todos/:id', (req, res) => {
    const changes = {};

    if (Object.hasOwn(req.body ?? {}, 'title')) {
      const title = normalizeTitle(req.body.title);
      if (!title) return jsonError(res, 400, 'Title is required.');
      changes.title = title;
    }

    if (Object.hasOwn(req.body ?? {}, 'completed')) {
      if (typeof req.body.completed !== 'boolean') {
        return jsonError(res, 400, 'Completed must be a boolean.');
      }
      changes.completed = req.body.completed;
    }

    if (Object.hasOwn(req.body ?? {}, 'dueDate')) {
      const dueDate = normalizeDueDate(req.body.dueDate);
      if (dueDate === undefined) return jsonError(res, 400, 'Due date must be a valid date.');
      changes.dueDate = dueDate;
    }

    if (!Object.keys(changes).length) {
      return jsonError(res, 400, 'No valid todo changes provided.');
    }

    const todo = store.update(req.params.id, changes);
    if (!todo) return jsonError(res, 404, 'Todo not found.');

    res.json({ todo });
  });

  app.delete('/api/todos/:id', (req, res) => {
    if (!store.delete(req.params.id)) return jsonError(res, 404, 'Todo not found.');
    res.status(204).end();
  });

  app.post('/api/todos/clear-completed', (_req, res) => {
    res.json({ deleted: store.clearCompleted() });
  });

  if (serveStatic) {
    const distPath = path.join(projectRoot, 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
  });

  return app;
}
