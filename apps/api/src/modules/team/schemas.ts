import { z } from 'zod';
import { passwordSchema } from '../auth/schemas';

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required').max(255),
  role: z.enum(['admin', 'manager', 'cashier', 'viewer']).default('viewer'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'cashier', 'viewer']),
});

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().max(100).optional(),
  userId: z.string().uuid().optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(16).max(200),
  password: z.string().max(128).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

export const acceptInvitationNewUserSchema = z.object({
  token: z.string().min(16).max(200),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});
