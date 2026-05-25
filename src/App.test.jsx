import { describe, expect, it } from 'vitest';
import { getVisibleTodos } from './App.jsx';

const todos = [
  { id: '1', title: 'Active', completed: false },
  { id: '2', title: 'Done', completed: true }
];

describe('getVisibleTodos', () => {
  it('returns all todos', () => {
    expect(getVisibleTodos(todos, 'all')).toHaveLength(2);
  });

  it('returns active todos', () => {
    expect(getVisibleTodos(todos, 'active')).toEqual([todos[0]]);
  });

  it('returns completed todos', () => {
    expect(getVisibleTodos(todos, 'completed')).toEqual([todos[1]]);
  });
});
