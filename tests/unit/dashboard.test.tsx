import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('admin dashboard', () => {
  it('shows academy stats, section cards and quick actions', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Meena/ }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('The academy at a glance')).toBeInTheDocument();

    // The stat grid from the seeded demo (8 students, one open query). The
    // stat text is split by a <small>, so check the whole stat cell.
    const studentsStat = (await screen.findAllByText('Students'))
      .map((node) => node.closest('.stat'))
      .find((cell) => cell !== null);
    expect(studentsStat?.textContent).toContain('8 active');
    expect(screen.getByText('Open queries')).toBeInTheDocument();
    expect(screen.getByText('Outstanding fees')).toBeInTheDocument();
    expect(screen.getByText('Collected')).toBeInTheDocument();
    expect(screen.getByText('Updates')).toBeInTheDocument();

    // Section cards for Tutors, Money, Queries and Parents.
    expect(await screen.findByRole('link', { name: /^Tutors/ })).toHaveAttribute('href', '/admin/tutors');
    expect(await screen.findByText('2 tutors on the roster')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /^Money/ })).toHaveAttribute('href', '/money');
    expect(await screen.findByRole('link', { name: /^Queries/ })).toHaveAttribute('href', '/queries');
    expect(await screen.findByText('1 open')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /^Parents/ })).toHaveAttribute('href', '/admin/parents');

    // Quick actions and the account row.
    expect(await screen.findByRole('link', { name: 'Add a student' })).toHaveAttribute('href', '/admin/students/new');
    expect(await screen.findByRole('link', { name: 'Add a tutor' })).toHaveAttribute('href', '/admin/tutors');
    expect(await screen.findByRole('link', { name: 'Invite a parent' })).toHaveAttribute('href', '/admin/parents');
    expect(await screen.findByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/you');
  });

  it('sends a tutor away from the dashboard', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Anita/ }));
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();

    window.history.pushState({}, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add a student' })).not.toBeInTheDocument();
  });
});
