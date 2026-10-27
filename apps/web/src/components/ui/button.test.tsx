import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders as a button with sensible defaults', () => {
    render(<Button>Save changes</Button>);
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toBeEnabled();
    expect(button.className).toContain('bg-brand-600');
  });

  it('calls the click handler and supports variants', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="danger" size="sm" onClick={onClick}>
        Delete store
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete store' });
    expect(button.className).toContain('bg-rose-600');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the control and hides icons while loading', () => {
    render(
      <Button
        loading
        leftIcon={<span data-testid="left-icon" />}
        rightIcon={<span data-testid="right-icon" />}
      >
        Publishing…
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Publishing…' });
    expect(button).toBeDisabled();
    expect(button.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
  });

  it('does not fire clicks while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Upgrade plan
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upgrade plan' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards refs so forms can focus the control', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Focus me</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
