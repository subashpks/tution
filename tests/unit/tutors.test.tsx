import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';

function at(path = '/') {
  window.history.pushState({}, '', path);
}

beforeEach(() => {
  window.localStorage.clear();
  at('/');
});

describe('tutors', () => {
  it('adds a tutor from the Tutors screen and opens the invite draft', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Meena/ }));
    await userEvent.click(await screen.findByRole('link', { name: /^Tutors/ }));
    expect(await screen.findByRole('heading', { name: 'Tutors' })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Add a tutor' })[0]);
    await userEvent.type(screen.getByLabelText('Name'), 'Nisha Patel');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '98100 98100');
    await userEvent.type(screen.getByLabelText('Email'), 'nisha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Maths' }));
    await userEvent.type(screen.getByLabelText('Stable meeting link'), 'https://meet.google.com/nisha');
    await userEvent.click(screen.getByRole('button', { name: 'Add the tutor' }));

    expect(await screen.findByText('Message ready')).toBeInTheDocument();
    expect(screen.getByText(/You are set up as a tutor for Maths/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Nisha Patel')).toBeInTheDocument();
  });

  it('adds a monthly review from the tutor profile', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Meena/ }));
    await userEvent.click(await screen.findByRole('link', { name: /^Tutors/ }));
    await userEvent.click(await screen.findByRole('link', { name: "Open Anita Rao's profile" }));

    expect(await screen.findByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText(/Strong month/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.type(screen.getByLabelText('Note'), 'Extra classes helped before the unit test.');
    await userEvent.click(screen.getByRole('button', { name: 'Save review' }));

    expect(await screen.findByText('Extra classes helped before the unit test.')).toBeInTheDocument();
  });

  it('keeps the Tutors screen for staff only', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Kabir/ }));
    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();

    window.history.pushState({}, '', '/admin/tutors');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a tutor' })).not.toBeInTheDocument();
  });
});
