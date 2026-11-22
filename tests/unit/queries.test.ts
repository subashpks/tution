import { beforeEach, describe, expect, it } from 'vitest';
import { demoRepo, resetDemoData } from '@/lib/data/demo';
import { RepoError } from '@/lib/data/types';

beforeEach(() => {
  window.localStorage.clear();
  resetDemoData();
});

async function as(role: 'admin' | 'tutor' | 'parent') {
  await demoRepo.signInDemo(role);
  const session = await demoRepo.getSession();
  if (!session) throw new Error('demo sign-in failed');
  return session;
}

describe('queries (demo repository)', () => {
  it('shows a parent only their own queries', async () => {
    await as('parent');
    const queries = await demoRepo.listQueries();
    expect(queries).toHaveLength(2);
    expect(queries.every((query) => query.openedByName === 'Suresh Iyer')).toBe(true);

    const diya = queries.find((query) => query.subject === 'English class timing')!;
    expect(diya).toMatchObject({
      studentName: 'Diya Iyer',
      status: 'open',
      resolvedAt: null,
    });
  });

  it('shows the admin the whole queue across statuses', async () => {
    await as('admin');
    const queries = await demoRepo.listQueries();
    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(new Set(queries.map((query) => query.status))).toEqual(
      new Set(['open', 'in_progress', 'resolved']),
    );
  });

  it('lets a parent ask a question and staff move it through the statuses', async () => {
    await as('parent');
    const created = await demoRepo.createQuery({
      studentId: 'stu_diya',
      subject: 'Pickup time',
      body: 'Can the Tuesday class shift to 5 pm?',
    });
    expect(created).toMatchObject({
      subject: 'Pickup time',
      status: 'open',
      studentName: 'Diya Iyer',
    });
    await expect(demoRepo.setQueryStatus(created.id, 'in_progress')).rejects.toMatchObject({
      code: 'forbidden',
    });

    await demoRepo.signOut();
    await as('tutor');
    const progressing = await demoRepo.setQueryStatus(created.id, 'in_progress');
    expect(progressing).toMatchObject({ status: 'in_progress', resolvedAt: null });
    const resolved = await demoRepo.setQueryStatus(created.id, 'resolved');
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).not.toBeNull();
    const reopened = await demoRepo.setQueryStatus(created.id, 'open');
    expect(reopened).toMatchObject({ status: 'open', resolvedAt: null });
  });

  it('rejects a parent query about another family\u2019s child', async () => {
    await as('parent');
    await expect(
      demoRepo.createQuery({ studentId: 'stu_kabir', subject: 'Homework', body: 'What is due?' }),
    ).rejects.toBeInstanceOf(RepoError);
  });
});
