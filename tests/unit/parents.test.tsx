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

describe('parents', () => {
  it('adds one parent to two children in a single invite', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Meena/ }));
    await userEvent.click(await screen.findByRole('link', { name: /^Parents/ }));
    expect(await screen.findByRole('heading', { name: 'Parents' })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Add a parent' })[0]);
    await userEvent.type(screen.getByLabelText('Name'), 'Rekha Iyer');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '98100 99000');
    await userEvent.type(screen.getByLabelText('Email for sign-in'), 'rekha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Aarav Iyer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Diya Iyer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create the invite' }));

    expect(await screen.findByText('Message ready')).toBeInTheDocument();
    expect(screen.getByText(/for Aarav, Diya/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Rekha Iyer')).toBeInTheDocument();
  });

  it('keeps the Parents screen for staff only', async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Kabir/ }));
    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();

    window.history.pushState({}, '', '/admin/parents');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a parent' })).not.toBeInTheDocument();
  });
});
