import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox, Field, Input, Select, Switch, Textarea } from './form';

describe('Field', () => {
  it('links the label, hint and error to the control', () => {
    render(
      <Field label="Store name" hint="Shown on receipts" htmlFor="store-name" required>
        <Input id="store-name" />
      </Field>,
    );

    expect(screen.getByLabelText(/Store name/)).toBe(screen.getByRole('textbox'));
    expect(screen.getByText('Shown on receipts')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('prefers the error message over the hint', () => {
    render(
      <Field label="Slug" hint="Lowercase only" error="Slug is already taken">
        <Input />
      </Field>,
    );
    expect(screen.getByText('Slug is already taken')).toBeInTheDocument();
    expect(screen.queryByText('Lowercase only')).not.toBeInTheDocument();
  });
});

describe('inputs', () => {
  it('marks invalid inputs for assistive technology', () => {
    render(<Input invalid aria-label="Email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders an icon slot and still forwards the ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Search" leftIcon={<span />} rightSlot={<span />} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.className).toContain('pl-10');
  });

  it('keeps select and textarea accessible', async () => {
    const onChange = vi.fn();
    render(
      <>
        <Select aria-label="Currency" defaultValue="EUR" onChange={onChange}>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </Select>
        <Textarea aria-label="Notes" rows={5} />
      </>,
    );

    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '5');
  });
});

describe('Checkbox', () => {
  it('renders label and description and forwards the ref', async () => {
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    render(
      <Checkbox
        ref={ref}
        label="Email me about low stock"
        description="At most once a day"
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByRole('checkbox', { name: /Email me about low stock/ });
    expect(screen.getByText('At most once a day')).toBeInTheDocument();
    expect(ref.current).toBe(checkbox);
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('Switch', () => {
  it('exposes switch semantics and toggles', async () => {
    const onChange = vi.fn();
    render(
      <Switch
        checked={false}
        onChange={onChange}
        label="Dark mode"
        description="Easier on the eyes"
      />,
    );

    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('cannot be toggled while disabled', async () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Live updates" disabled />);
    const control = screen.getByRole('switch', { name: 'Live updates' });
    expect(control).toBeDisabled();
    await userEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });
});
