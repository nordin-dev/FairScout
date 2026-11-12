import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { logout, register, resetAccounts } from '../src/lib/account';
import { account as t } from '../src/lib/accountText';
import { Account } from '../src/screens/Account/Account';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function renderAccount() {
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Where />
      <Routes>
        <Route path="/account" element={<Account />} />
        <Route path="/my-picks" element={<p>picks page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
async function fill(name: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(document.querySelector('button[type="submit"]') as HTMLElement);
}
const mode = (name: string) => userEvent.click(screen.getByRole('button', { name, pressed: false }));

beforeEach(() => {
  resetAccounts();
  localStorage.clear();
});

describe('account screen', () => {
  it('starts on Log in with a password field and the honest caption', () => {
    renderAccount();
    expect(screen.getByRole('button', { name: 'Log in', pressed: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByText(t.caption)).toBeInTheDocument();
  });

  it('creates an account, signs in and goes to /my-picks', async () => {
    renderAccount();
    await mode('Create account');
    await fill('Ana', 'secret');
    expect(await screen.findByText('picks page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/my-picks');
  });

  it('shows the name and the password errors', async () => {
    renderAccount();
    const user = userEvent.setup();
    await mode('Create account');
    await fill('A', 'secret');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.name);
    await user.clear(screen.getByLabelText('Name'));
    await user.clear(screen.getByLabelText('Password'));
    await fill('Ana', 'abc');
    expect(await screen.findByText(t.errors.password)).toBeInTheDocument();
  });

  it('shows wrong and taken, and clears the error when the mode changes', async () => {
    await register('Ana', 'secret');
    logout();
    renderAccount();
    await fill('Ana', 'nope');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.wrong);
    await mode('Create account');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLElement);
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.taken);
  });

  it('shows who is signed in and logs out', async () => {
    await register('Ana', 'secret');
    renderAccount();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Signed in as Ana');
    expect(screen.getByRole('link', { name: 'Go to My picks' })).toHaveAttribute('href', '/my-picks');
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});
