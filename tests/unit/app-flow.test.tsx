import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

/**
 * The first real journey through the app: the router, the auth provider, the
 * demo repository and the shell all have to agree before a screen appears.
 * Each role lands somewhere different on purpose — that mapping is the whole
 * permission model as a parent experiences it.
 */

function at(path = '/') {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  window.localStorage.clear();
  at('/');
});

describe('signing in to the demo', () => {
  it('takes the admin to the Dashboard', async () => {
    render(<App />);

    expect(await screen.findByText('Enter the demo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Meena/ }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    // The admin nav is Dashboard, Today, Students — the rest lives on the dashboard.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/today');
    expect(screen.getByRole('link', { name: 'Students' })).toHaveAttribute('href', '/admin/students');
    expect(screen.queryByRole('link', { name: 'You' })).not.toBeInTheDocument();
    // The section cards link to their screens; one seeded open query shows on the Queries card.
    expect(await screen.findByRole('link', { name: /^Tutors/ })).toHaveAttribute('href', '/admin/tutors');
    expect(await screen.findByRole('link', { name: /^Money/ })).toHaveAttribute('href', '/money');
    expect(await screen.findByRole('link', { name: /^Queries/ })).toHaveAttribute('href', '/queries');
    expect(await screen.findByRole('link', { name: /^Parents/ })).toHaveAttribute('href', '/admin/parents');
    expect(await screen.findByText('1 open')).toBeInTheDocument();
  });

  it('takes a parent to their child, not to the staff screens', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Suresh/ }));

    expect(await screen.findByRole('heading', { name: "Aarav's home" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: 'Students' })).not.toBeInTheDocument();
  });

  it('takes a student to their own home with a student-only nav', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Kabir/ }));

    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/student');
    const timetableLinks = screen.getAllByRole('link', { name: 'Timetable' });
    expect(timetableLinks.length).toBeGreaterThan(0);
    for (const link of timetableLinks) expect(link).toHaveAttribute('href', '/timetable');
    const inboxLinks = screen.getAllByRole('link', { name: 'Inbox' });
    expect(inboxLinks.length).toBeGreaterThan(0);
    for (const link of inboxLinks) expect(link).toHaveAttribute('href', '/inbox');
    expect(screen.queryByRole('link', { name: 'Money' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Queries' })).not.toBeInTheDocument();
  });

  it('sends a student away from staff and money screens', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Kabir/ }));
    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();

    window.history.pushState({}, '', '/money');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();
    expect(screen.queryByText('Outstanding')).not.toBeInTheDocument();
  });

  it('keeps a signed-out person on the sign-in screen', async () => {
    at('/today');
    render(<App />);

    expect(await screen.findByText('Enter the demo')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument();
  });
});
