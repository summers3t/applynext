// src/lib/filterStore.ts
import { writable } from 'svelte/store';

export type StatusFilter = 'all' | 'open' | 'in_progress' | 'done';
export type DueFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'none';

export const statusFilter = writable<StatusFilter>('all');
export const dueFilter = writable<DueFilter>('all');
export const searchQuery = writable('');
