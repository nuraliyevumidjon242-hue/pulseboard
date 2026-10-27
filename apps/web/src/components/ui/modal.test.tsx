import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, Modal } from './modal';

describe('Modal', () => {
  it('renders accessible dialog content in a portal', async () => {
    render(
      <Modal
        open
        onClose={() => undefined}
        title="Invite teammate"
        description="They get an email."
      >
        <input aria-label="Email address" />
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Invite teammate' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('They get an email.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveFocus());
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape and restores body scroll', async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal open onClose={onClose} title="Close me">
        <p>Content</p>
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes when the backdrop is clicked, unless dismissible is false', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open onClose={onClose} title="Backdrop">
        <p>Content</p>
      </Modal>,
    );

    await userEvent.click(document.querySelector('.absolute.inset-0') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Modal open onClose={onClose} title="Locked" dismissible={false}>
        <p>Content</p>
      </Modal>,
    );
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
    await userEvent.click(document.querySelector('.absolute.inset-0') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render anything when closed', () => {
    render(
      <Modal open={false} onClose={() => undefined} title="Hidden">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('confirms destructive actions with the requested labels', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete store"
        description="Nordwind Café will be removed."
        confirmLabel="Delete store"
        destructive
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Delete store' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete store' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks both actions while the mutation is in flight', () => {
    render(
      <ConfirmDialog
        open
        loading
        onClose={() => undefined}
        onConfirm={() => undefined}
        title="Remove member"
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });
});
