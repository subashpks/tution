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

describe('classes and the calendar', () => {
  it('opens a class and sends the reminder to the family and the tutor', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Meena/ }));
    await userEvent.click(await screen.findByRole('link', { name: 'Today' }));
    await userEvent.click(await screen.findByRole('link', { name: 'See the whole week' }));

    // Pick a day that actually has classes, then the first class on it.
    const day = (await screen.findAllByRole('button', { name: /, [1-9] class/ }))[0];
    await userEvent.click(day);
    const card = (await screen.findAllByRole('button', { name: /^Open .* class$/ }))[0];
    await userEvent.click(card);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send reminder' }));

    expect(await screen.findByText('Ready to send')).toBeInTheDocument();
    const whatsapp = await screen.findAllByRole('link', { name: /Open WhatsApp for/ });
    expect(whatsapp).toHaveLength(2);
    expect(screen.getAllByText('Family').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tutor').length).toBeGreaterThan(0);
  });

  it('offers a parent a calendar, and explains that the demo has no live feed', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Suresh/ }));
    await userEvent.click(await screen.findByRole('link', { name: 'Your account' }));

    expect(await screen.findByText('Every class, with the Meet link')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Calendar feed' }));

    expect(await screen.findByText(/no live feed address/)).toBeInTheDocument();
  });
});
