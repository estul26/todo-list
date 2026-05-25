import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function createTodoStore(dbPath = process.env.DB_PATH || 'data/todos.sqlite') {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const mapTodo = (row) => ({
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  return {
    list() {
      return db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all().map(mapTodo);
    },

    create(title) {
      const now = new Date().toISOString();
      const todo = {
        id: randomUUID(),
        title,
        completed: 0,
        created_at: now,
        updated_at: now
      };

      db.prepare(`
        INSERT INTO todos (id, title, completed, created_at, updated_at)
        VALUES (@id, @title, @completed, @created_at, @updated_at)
      `).run(todo);

      return mapTodo(todo);
    },

    update(id, changes) {
      const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
      if (!existing) return null;

      const next = {
        title: changes.title ?? existing.title,
        completed: changes.completed === undefined ? existing.completed : Number(changes.completed),
        updated_at: new Date().toISOString(),
        id
      };

      db.prepare(`
        UPDATE todos
        SET title = @title, completed = @completed, updated_at = @updated_at
        WHERE id = @id
      `).run(next);

      return mapTodo(db.prepare('SELECT * FROM todos WHERE id = ?').get(id));
    },

    delete(id) {
      return db.prepare('DELETE FROM todos WHERE id = ?').run(id).changes > 0;
    },

    clearCompleted() {
      return db.prepare('DELETE FROM todos WHERE completed = 1').run().changes;
    },

    close() {
      db.close();
    }
  };
}
