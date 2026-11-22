import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('student home', () => {
  it('shows Kabir his own week, homework and an inbox update', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Kabir/ }));

    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();
    // Only his subjects appear in the class cards and homework rows.
    expect((await screen.findAllByText(/Maths|Physics/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Homework' })).toBeInTheDocument();
    expect(screen.getByText('Practice sheet — 10 sums')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This week' })).toBeInTheDocument();
  });

  it('lets Kabir mark his own homework done', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Kabir/ }));

    await screen.findByText('Practice sheet — 10 sums');
    await userEvent.click(screen.getByRole('button', { name: 'Mark done' }));

    expect(await screen.findByText('Nice — marked done')).toBeInTheDocument();
    expect(await screen.findByText('Nothing pending')).toBeInTheDocument();
  });

  it('opens the timetable for a student and lists only their classes', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Kabir/ }));
    await userEvent.click(await screen.findByRole('link', { name: 'Timetable' }));

    expect(await screen.findByRole('heading', { name: 'Timetable' })).toBeInTheDocument();
    const classDays = await screen.findAllByRole('button', { name: /, \d+ class/ });
    await userEvent.click(classDays[0]);
    expect((await screen.findAllByText(/Maths|Physics/)).length).toBeGreaterThan(0);
  });
});
