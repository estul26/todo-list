async function parseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || 'Request failed.');
  }

  return data;
}

export async function listTodos() {
  const data = await parseResponse(await fetch('/api/todos'));
  return data.todos;
}

export async function createTodo(title) {
  const data = await parseResponse(await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  }));
  return data.todo;
}

export async function updateTodo(id, changes) {
  const data = await parseResponse(await fetch(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes)
  }));
  return data.todo;
}

export async function deleteTodo(id) {
  await parseResponse(await fetch(`/api/todos/${id}`, { method: 'DELETE' }));
}

export async function clearCompletedTodos() {
  const data = await parseResponse(await fetch('/api/todos/clear-completed', { method: 'POST' }));
  return data.deleted;
}
