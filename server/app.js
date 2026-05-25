import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTodoStore } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function normalizeTitle(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function jsonError(res, status, error) {
  return res.status(status).json({ error });
}

export function createApp({ store = createTodoStore(), serveStatic = process.env.NODE_ENV === 'production' } = {}) {
  const app = express();

  app.use(express.json());

  app.get('/api/todos', (_req, res) => {
    res.json({ todos: store.list() });
  });

  app.post('/api/todos', (req, res) => {
    const title = normalizeTitle(req.body?.title);
    if (!title) return jsonError(res, 400, 'Title is required.');

    res.status(201).json({ todo: store.create(title) });
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
