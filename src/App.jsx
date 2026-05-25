import { useEffect, useMemo, useState } from 'react';
import {
  clearCompletedTodos,
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo
} from './api.js';

const filters = ['all', 'active', 'completed'];

function formatCount(count, label) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

export function getVisibleTodos(todos, filter) {
  if (filter === 'active') return todos.filter((todo) => !todo.completed);
  if (filter === 'completed') return todos.filter((todo) => todo.completed);
  return todos;
}

export function App() {
  const [todos, setTodos] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadTodos() {
      try {
        const loaded = await listTodos();
        if (!ignore) setTodos(loaded);
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadTodos();
    return () => {
      ignore = true;
    };
  }, []);

  const activeCount = useMemo(() => todos.filter((todo) => !todo.completed).length, [todos]);
  const completedCount = todos.length - activeCount;
  const visibleTodos = getVisibleTodos(todos, filter);

  async function runAction(action) {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(todo) {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle('');
  }

  async function handleAdd(event) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    await runAction(async () => {
      const todo = await createTodo(title);
      setTodos((current) => [todo, ...current]);
      setNewTitle('');
    });
  }

  async function handleToggle(todo) {
    await runAction(async () => {
      const updated = await updateTodo(todo.id, { completed: !todo.completed });
      setTodos((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    });
  }

  async function handleSaveEdit(todo) {
    const title = editingTitle.trim();
    if (!title) return;

    await runAction(async () => {
      const updated = await updateTodo(todo.id, { title });
      setTodos((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      cancelEdit();
    });
  }

  async function handleDelete(id) {
    await runAction(async () => {
      await deleteTodo(id);
      setTodos((current) => current.filter((todo) => todo.id !== id));
    });
  }

  async function handleClearCompleted() {
    await runAction(async () => {
      await clearCompletedTodos();
      setTodos((current) => current.filter((todo) => !todo.completed));
    });
  }

  return (
    <main className="app-shell">
      <section className="todo-panel" aria-labelledby="app-title">
        <header className="app-header">
          <div>
            <p className="eyebrow">Today</p>
            <h1 id="app-title">Todo List</h1>
          </div>
          <div className="count-pill" aria-label={formatCount(activeCount, 'active task')}>
            {activeCount}
          </div>
        </header>

        <form className="add-form" onSubmit={handleAdd}>
          <label className="sr-only" htmlFor="new-todo">New todo</label>
          <input
            id="new-todo"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Add a task"
            disabled={saving}
          />
          <button type="submit" disabled={saving || !newTitle.trim()}>
            Add
          </button>
        </form>

        {error ? <div className="error-banner" role="alert">{error}</div> : null}

        <div className="toolbar">
          <div className="filters" aria-label="Todo filters">
            {filters.map((name) => (
              <button
                key={name}
                className={filter === name ? 'active' : ''}
                type="button"
                onClick={() => setFilter(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <button
            className="clear-button"
            type="button"
            onClick={handleClearCompleted}
            disabled={saving || completedCount === 0}
          >
            Clear completed
          </button>
        </div>

        <div className="summary-line">
          <span>{formatCount(activeCount, 'active')}</span>
          <span>{formatCount(completedCount, 'completed')}</span>
        </div>

        {loading ? (
          <div className="empty-state">Loading tasks...</div>
        ) : visibleTodos.length ? (
          <ul className="todo-list">
            {visibleTodos.map((todo) => (
              <li key={todo.id} className={todo.completed ? 'completed' : ''}>
                <input
                  className="check"
                  aria-label={`Mark ${todo.title} ${todo.completed ? 'active' : 'completed'}`}
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggle(todo)}
                  disabled={saving}
                />

                {editingId === todo.id ? (
                  <form className="edit-form" onSubmit={(event) => {
                    event.preventDefault();
                    handleSaveEdit(todo);
                  }}>
                    <input
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      autoFocus
                    />
                    <button type="submit" disabled={saving || !editingTitle.trim()}>Save</button>
                    <button type="button" onClick={cancelEdit}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <span className="todo-title">{todo.title}</span>
                    <div className="todo-actions">
                      <button type="button" onClick={() => beginEdit(todo)}>Edit</button>
                      <button type="button" onClick={() => handleDelete(todo.id)}>Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            {filter === 'all' ? 'No tasks yet.' : `No ${filter} tasks.`}
          </div>
        )}
      </section>
    </main>
  );
}
