import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, MailPlus, Send, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, getErrorMessage } from '../../lib/api';
import { firstFieldErrors, localizedZodResolver } from '../../lib/forms';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../lib/permissions';
import { useStoreContext } from '../../hooks/use-store-context';
import { toast } from '../../stores/toast-store';
import type { StoreRole } from '../../types';
import { Button } from '../../components/ui/button';
import { Field, Input, Select } from '../../components/ui/form';
import { FormAlert } from '../../components/auth/auth-layout';
import { Modal } from '../../components/ui/modal';
import { t } from '../../lib/i18n';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  role: z.enum(['admin', 'manager', 'cashier', 'viewer']),
});

type InviteForm = z.infer<typeof schema>;

interface InviteResponse {
  status: 'added' | 'invited';
  userId?: string;
  invitationId?: string;
  devToken?: string;
  message: string;
}

export function InviteMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { storeId, store } = useStoreContext();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<InviteResponse | null>(null);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteForm>({
    resolver: localizedZodResolver(schema),
    defaultValues: { email: '', role: 'cashier' },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setFieldErrors({});
    setResult(null);
    setCopied(false);
    reset({ email: '', role: 'cashier' });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setFieldErrors({});
    try {
      const response = await api.post<{ data: InviteResponse }>(
        `/stores/${storeId}/team/invite`,
        values,
      );
      setResult(response.data.data);
      setInvitedEmail(values.email);
      toast.success(
        t(response.data.data.status === 'added' ? 'Member added' : 'Invitation sent'),
        response.data.data.message,
      );
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setFieldErrors(firstFieldErrors(error));
    }
  });

  const inviteLink = result?.devToken
    ? `${window.location.origin}/accept-invitation?token=${result.devToken}`
    : null;

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success(t('Invite link copied'));
    } catch {
      toast.error(t('Could not copy'), t('Select the link manually and copy it.'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Invite a team member')}
      description={store ? t('Give someone access to {{store}}', { store: store.name }) : undefined}
      size="md"
      footer={
        result ? (
          <Button onClick={onClose}>{t('Done')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={onSubmit}
              loading={isSubmitting}
              leftIcon={<Send className="h-4 w-4" />}
            >
              {t('Send invitation')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center rounded-2xl bg-emerald-50 p-5 text-center dark:bg-emerald-500/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Check className="h-6 w-6" />
            </span>
            <p className="mt-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {t(result.status === 'added' ? 'Access granted' : 'Invitation on its way')}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
              {result.status === 'added'
                ? t('{{email}} now has access to {{store}}.', {
                    email: invitedEmail,
                    store: store?.name ?? '',
                  })
                : t('We sent an invitation to {{email}}. It expires in seven days.', {
                    email: invitedEmail,
                  })}
            </p>
          </div>

          {inviteLink ? (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-3.5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {t('Development invite link')}
              </p>
              <p className="mt-1 break-all font-mono text-[10px] text-amber-800 dark:text-amber-200">
                {inviteLink}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => void copyLink()}
                leftIcon={
                  copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />
                }
              >
                {t(copied ? 'Copied' : 'Copy link')}
              </Button>
            </div>
          ) : null}

          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setResult(null);
              reset({ email: '', role: 'cashier' });
            }}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            {t('Invite another person')}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {serverError ? <FormAlert>{serverError}</FormAlert> : null}

          <Field
            label={t('Email address')}
            htmlFor="invite-email"
            error={errors.email?.message ?? fieldErrors.email}
            hint={t('If they already have a PulseBoard account, access is granted instantly.')}
          >
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              invalid={Boolean(errors.email ?? fieldErrors.email)}
              {...register('email')}
            />
          </Field>

          <Field label={t('Role')} htmlFor="invite-role" error={errors.role?.message}>
            <Select id="invite-role" {...register('role')}>
              {(['admin', 'manager', 'cashier', 'viewer'] as StoreRole[]).map((role) => (
                <option key={role} value={role}>
                  {t(ROLE_LABELS[role])}
                </option>
              ))}
            </Select>
          </Field>

          <div className="rounded-xl bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-950/40 dark:text-ink-400">
            <p className="font-semibold text-ink-700 dark:text-ink-200">{t('Role permissions')}</p>
            <ul className="mt-1.5 space-y-1">
              {(['admin', 'manager', 'cashier', 'viewer'] as StoreRole[]).map((role) => (
                <li key={role}>
                  <span className="font-semibold text-ink-700 dark:text-ink-200">
                    {t(ROLE_LABELS[role])}:
                  </span>{' '}
                  {t(ROLE_DESCRIPTIONS[role])}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-ink-200 p-3 text-[11px] text-ink-500 dark:border-ink-700 dark:text-ink-400">
            <MailPlus className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            {t(
              'Invitations expire after seven days. You can resend or revoke them from the invitations tab.',
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
