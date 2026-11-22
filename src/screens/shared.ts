import type { Role } from '@/lib/data/types';
import { dayPart } from '@/lib/dates';

export function landingFor(role: Role): string {
  if (role === 'admin') return '/dashboard';
  if (role === 'parent') return '/home';
  if (role === 'student') return '/student';
  return '/today';
}

export function greeting(now: Date = new Date()): string {
  const part = dayPart(now);
  if (part === 'morning') return 'Good morning';
  if (part === 'afternoon') return 'Good afternoon';
  return 'Good evening';
}

export function errorMessage(cause: unknown, fallback = 'Something went wrong'): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function roleLabel(role: Role): string {
  if (role === 'admin') return 'Academy admin';
  if (role === 'tutor') return 'Tutor';
  if (role === 'student') return 'Student';
  return 'Parent';
}
