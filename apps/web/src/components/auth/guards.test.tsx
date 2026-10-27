import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth, RequirePermission } from './guards';
import { useAuthStore } from '../../stores/auth-store';
import type { StoreRole, StoreSummary } from '../../types';

function store(role: StoreRole): StoreSummary {
  return {
    id: 'store-1',
    name: 'Nordwind Café',
    city: 'Berlin',
    country: 'DE',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    logoUrl: null,
    isActive: true,
    role,
    isOwner: role === 'admin',
  };
}

const member = {
  id: 'user-1',
  email: 'owner@demo.dev',
  firstName: 'Mara',
  lastName: 'Vogel',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderAt(ui: React.ReactNode, initialEntry = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route path="/stores" element={<p>Store picker</p>} />
        <Route path="/dashboard" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    stores: [],
    preferences: null,
    status: 'booting',
    activeStoreId: null,
  });
});

describe('RequireAuth', () => {
  it('shows the boot splash while restoring the session', () => {
    renderAt(
      <RequireAuth>
        <p>Dashboard</p>
      </RequireAuth>,
    );
    expect(screen.getByText('Restoring your session…')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('redirects guests to the login screen', () => {
    useAuthStore.setState({ status: 'guest' });
    renderAt(
      <RequireAuth>
        <p>Dashboard</p>
      </RequireAuth>,
    );
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('renders children for authenticated members', () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: member as never,
      stores: [store('admin')],
      activeStoreId: 'store-1',
    });
    renderAt(
      <RequireAuth>
        <p>Dashboard</p>
      </RequireAuth>,
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});

describe('RequirePermission', () => {
  it('sends members without a store to the store picker', () => {
    useAuthStore.setState({ status: 'authenticated', stores: [], activeStoreId: null });
    renderAt(
      <RequirePermission permission="sales:read">
        <p>Sales</p>
      </RequirePermission>,
    );
    expect(screen.getByText('Store picker')).toBeInTheDocument();
  });

  it('explains missing access instead of leaking the page', () => {
    useAuthStore.setState({
      status: 'authenticated',
      stores: [store('viewer')],
      activeStoreId: 'store-1',
    });
    renderAt(
      <RequirePermission permission="team:manage">
        <p>Team management</p>
      </RequirePermission>,
    );
    expect(screen.getByText('You need additional access')).toBeInTheDocument();
    expect(screen.getByText(/Nordwind Café/)).toBeInTheDocument();
    expect(screen.queryByText('Team management')).not.toBeInTheDocument();
  });

  it('renders the page when the role grants the permission', () => {
    useAuthStore.setState({
      status: 'authenticated',
      stores: [store('manager')],
      activeStoreId: 'store-1',
    });
    renderAt(
      <RequirePermission permission="inventory:write">
        <p>Inventory editor</p>
      </RequirePermission>,
    );
    expect(screen.getByText('Inventory editor')).toBeInTheDocument();
  });

  it('lets the member navigate back from the access notice', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    useAuthStore.setState({
      status: 'authenticated',
      stores: [store('cashier')],
      activeStoreId: 'store-1',
    });
    renderAt(
      <RequirePermission permission="settings:write">
        <p>Settings</p>
      </RequirePermission>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
