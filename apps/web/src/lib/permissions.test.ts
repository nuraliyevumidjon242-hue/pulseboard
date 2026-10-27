import { describe, expect, it } from 'vitest';
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS } from './permissions';

describe('role permissions', () => {
  it('gives administrators full store control', () => {
    expect(can('admin', 'store:update')).toBe(true);
    expect(can('admin', 'settings:write')).toBe(true);
    expect(can('admin', 'team:manage')).toBe(true);
  });

  it('keeps managers out of destructive settings', () => {
    expect(can('manager', 'sales:write')).toBe(true);
    expect(can('manager', 'inventory:write')).toBe(true);
    expect(can('manager', 'settings:write')).toBe(false);
    expect(can('manager', 'team:manage')).toBe(false);
  });

  it('limits cashiers and viewers to their workflow', () => {
    expect(can('cashier', 'sales:write')).toBe(true);
    expect(can('cashier', 'products:write')).toBe(false);
    expect(can('viewer', 'sales:read')).toBe(true);
    expect(can('viewer', 'sales:write')).toBe(false);
  });

  it('denies everything without a role', () => {
    expect(can(undefined, 'sales:read')).toBe(false);
  });

  it('exposes readable labels for every role', () => {
    for (const role of ['admin', 'manager', 'cashier', 'viewer'] as const) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });
});
