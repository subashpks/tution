import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('person profiles', () => {
  it('opens a tutor profile, shows the dashboard and edits the class rate', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Meena/ }));
    await userEvent.click(await screen.findByRole('link', { name: /^Tutors/ }));
    await userEvent.click(await screen.findByRole('link', { name: "Open Anita Rao's profile" }));

    expect(await screen.findByRole('heading', { name: 'Scoreboard' })).toBeInTheDocument();
    expect(screen.getByText('Wage this month')).toBeInTheDocument();
    expect(screen.getByText('Recent classes')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Students' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const rate = screen.getByLabelText('Rate per class (₹)');
    await userEvent.clear(rate);
    await userEvent.type(rate, '500');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Anita Rao updated')).toBeInTheDocument();
    expect((await screen.findAllByText('₹500')).length).toBeGreaterThan(0);
  });

  it('opens a parent profile with children, fees and upcoming classes', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Meena/ }));
    await userEvent.click(await screen.findByRole('link', { name: /^Parents/ }));
    await userEvent.click(await screen.findByRole('link', { name: "Open Suresh Iyer's profile" }));

    expect(await screen.findByRole('heading', { name: 'Children' })).toBeInTheDocument();
    expect(screen.getByText('Open fees')).toBeInTheDocument();
    expect(screen.getAllByText('Aarav Iyer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Diya Iyer').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Upcoming classes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('shows a student their own account without any family section', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Kabir/ }));
    await userEvent.click(await screen.findByRole('link', { name: 'You' }));

    expect(await screen.findByText('Kabir Menon')).toBeInTheDocument();
    expect(screen.getByText('Student')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Children' })).not.toBeInTheDocument();
  });
});
