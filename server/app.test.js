import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createApp } from './app.js';
import { createTodoStore } from './db.js';

describe('todo API', () => {
  let server;
  let baseUrl;
  let store;

  before(async () => {
    store = createTodoStore(':memory:');
    server = createServer(createApp({ store, serveStatic: false }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });

  async function request(path, options) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null
    };
  }

  it('creates, lists, updates, and deletes todos', async () => {
    const created = await request('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: '  Ship app  ', dueDate: '2026-05-25' })
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.todo.title, 'Ship app');
    assert.equal(created.body.todo.completed, false);
    assert.equal(created.body.todo.dueDate, '2026-05-25');

    const listed = await request('/api/todos');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.todos.length, 1);
    assert.equal(listed.body.todos[0].dueDate, '2026-05-25');

    const updated = await request(`/api/todos/${created.body.todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true, title: 'Ship polished app', dueDate: null })
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.todo.completed, true);
    assert.equal(updated.body.todo.title, 'Ship polished app');
    assert.equal(updated.body.todo.dueDate, null);

    const deleted = await request(`/api/todos/${created.body.todo.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
  });

  it('validates titles and unknown todos', async () => {
    const invalid = await request('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: '   ' })
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'Title is required.');

    const missing = await request('/api/todos/missing-id', {
      method: 'PATCH',
      body: JSON.stringify({ completed: true })
    });
    assert.equal(missing.status, 404);
  });

  it('validates due dates', async () => {
    const invalid = await request('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: 'Bad date', dueDate: '2026-99-99' })
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'Due date must be a valid date.');

    const created = await request('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: 'Good date', dueDate: '' })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.todo.dueDate, null);

    const badUpdate = await request(`/api/todos/${created.body.todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dueDate: 'tomorrow' })
    });
    assert.equal(badUpdate.status, 400);
    assert.equal(badUpdate.body.error, 'Due date must be a valid date.');

    const deleted = await request(`/api/todos/${created.body.todo.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
  });

  it('clears completed todos', async () => {
    const first = await request('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: 'Done task' })
    });
    await request(`/api/todos/${first.body.todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true })
    });
    await request('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: 'Active task' })
    });

    const cleared = await request('/api/todos/clear-completed', { method: 'POST' });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.deleted, 1);

    const listed = await request('/api/todos');
    assert.equal(listed.body.todos.length, 1);
    assert.equal(listed.body.todos[0].title, 'Active task');
  });
});

describe('todo store migration', () => {
  it('adds due dates to existing todo databases', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-list-test-'));
    const dbPath = path.join(dir, 'todos.sqlite');
    const db = new Database(dbPath);

    db.exec(`
      CREATE TABLE todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO todos (id, title, completed, created_at, updated_at)
      VALUES ('old-id', 'Old task', 0, '2026-05-24T12:00:00.000Z', '2026-05-24T12:00:00.000Z');
    `);
    db.close();

    const store = createTodoStore(dbPath);
    const todos = store.list();

    assert.equal(todos.length, 1);
    assert.equal(todos[0].title, 'Old task');
    assert.equal(todos[0].dueDate, null);

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('password auth', () => {
  let server;
  let baseUrl;
  let store;
  let cookie = '';

  before(async () => {
    store = createTodoStore(':memory:');
    server = createServer(createApp({ store, serveStatic: false, password: 'secret-password' }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {})
      },
      ...options
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null
    };
  }

  it('requires login before using todos', async () => {
    const status = await request('/api/auth/status');
    assert.equal(status.status, 200);
    assert.equal(status.body.enabled, true);
    assert.equal(status.body.authenticated, false);

    const blocked = await request('/api/todos');
    assert.equal(blocked.status, 401);
    assert.equal(blocked.body.error, 'Password required.');
  });

  it('rejects invalid passwords and accepts the configured password', async () => {
    const rejected = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong' })
    });
    assert.equal(rejected.status, 401);
    assert.equal(rejected.body.error, 'Invalid password.');

    const accepted = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'secret-password' })
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.authenticated, true);

    const created = await request('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: 'Private task' })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.todo.title, 'Private task');
  });

  it('logs out and blocks todos again', async () => {
    const loggedOut = await request('/api/auth/logout', { method: 'POST' });
    assert.equal(loggedOut.status, 204);

    const blocked = await request('/api/todos');
    assert.equal(blocked.status, 401);
  });
});
