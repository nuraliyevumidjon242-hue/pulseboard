import { ArrowRight, KeyRound, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { api, getErrorMessage } from '../../lib/api';
import { firstFieldErrors, localizedZodResolver } from '../../lib/forms';
import { toast } from '../../stores/toast-store';
import { AuthLayout, FormAlert } from '../../components/auth/auth-layout';
import { PasswordInput } from '../../components/auth/password-input';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/form';
import { t } from '../../lib/i18n';

const schema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type ResetForm = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: localizedZodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setFieldErrors({});
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      toast.success(t('Password updated'), t('Sign in with your new password.'));
      navigate('/login', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setFieldErrors(firstFieldErrors(error));
    }
  });

  if (!token) {
    return (
      <AuthLayout
        title={t('Invalid reset link')}
        subtitle={t('This link is missing its security token.')}
      >
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <p className="text-sm text-rose-700 dark:text-rose-300">
              {t(
                'Reset links expire after one hour and can only be used once. Request a fresh link to continue.',
              )}
            </p>
          </div>
        </div>
        <Button className="mt-5" fullWidth onClick={() => navigate('/forgot-password')}>
          {t('Request a new link')}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('Choose a new password')}
      subtitle={t(
        'Pick a strong password you have not used elsewhere. You will be signed out of other devices.',
      )}
      footer={
        <Link
          to="/login"
          className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          {t('Back to sign in')}
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError ? <FormAlert>{serverError}</FormAlert> : null}
        <Field
          label={t('New password')}
          htmlFor="new-password"
          error={errors.password?.message ?? fieldErrors.password}
        >
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            placeholder={t('At least 10 characters')}
            invalid={Boolean(errors.password ?? fieldErrors.password)}
            {...register('password')}
          />
        </Field>
        <Field
          label={t('Confirm new password')}
          htmlFor="confirm-new-password"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirm-new-password"
            autoComplete="new-password"
            placeholder={t('Repeat new password')}
            invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          leftIcon={<KeyRound className="h-4 w-4" />}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {t('Update password')}
        </Button>
      </form>
    </AuthLayout>
  );
}
