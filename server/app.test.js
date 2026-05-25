import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createServer } from 'node:http';
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
      body: JSON.stringify({ title: '  Ship app  ' })
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.todo.title, 'Ship app');
    assert.equal(created.body.todo.completed, false);

    const listed = await request('/api/todos');
    assert.equal(listed.status, 200);
    assert.equal(listed.body.todos.length, 1);

    const updated = await request(`/api/todos/${created.body.todo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true, title: 'Ship polished app' })
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.todo.completed, true);
    assert.equal(updated.body.todo.title, 'Ship polished app');

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
