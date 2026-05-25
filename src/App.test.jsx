import { describe, expect, it } from 'vitest';
import { getGroupedTodos, getVisibleTodos } from './App.jsx';

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

describe('getGroupedTodos', () => {
  const datedTodos = [
    {
      id: '1',
      title: 'No date newest',
      completed: false,
      dueDate: null,
      createdAt: '2026-05-24T12:00:00.000Z'
    },
    {
      id: '2',
      title: 'Upcoming later',
      completed: false,
      dueDate: '2026-05-28',
      createdAt: '2026-05-20T12:00:00.000Z'
    },
    {
      id: '3',
      title: 'Today',
      completed: false,
      dueDate: '2026-05-25',
      createdAt: '2026-05-23T12:00:00.000Z'
    },
    {
      id: '4',
      title: 'Overdue',
      completed: false,
      dueDate: '2026-05-24',
      createdAt: '2026-05-22T12:00:00.000Z'
    },
    {
      id: '5',
      title: 'Upcoming sooner',
      completed: false,
      dueDate: '2026-05-26',
      createdAt: '2026-05-21T12:00:00.000Z'
    }
  ];

  it('groups todos by due date status', () => {
    expect(getGroupedTodos(datedTodos, '2026-05-25').map((group) => group.title)).toEqual([
      'Overdue',
      'Today',
      'Upcoming',
      'No date'
    ]);
  });

  it('sorts upcoming todos by due date', () => {
    const upcoming = getGroupedTodos(datedTodos, '2026-05-25').find(
      (group) => group.key === 'upcoming'
    );

    expect(upcoming.todos.map((todo) => todo.title)).toEqual([
      'Upcoming sooner',
      'Upcoming later'
    ]);
  });
});
