import { ArrowRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api, getErrorMessage } from '../../lib/api';
import { firstFieldErrors, localizedZodResolver } from '../../lib/forms';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from '../../stores/toast-store';
import type { AuthResponse } from '../../types';
import { AuthLayout, FormAlert } from '../../components/auth/auth-layout';
import { PasswordInput } from '../../components/auth/password-input';
import { Button } from '../../components/ui/button';
import { Checkbox, Field, Input } from '../../components/ui/form';
import { t } from '../../lib/i18n';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Owner', email: 'owner@demo.dev' },
  { label: 'Manager', email: 'manager@demo.dev' },
  { label: 'Cashier', email: 'cashier@demo.dev' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authenticate = useAuthStore((state) => state.authenticate);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: localizedZodResolver(schema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setFieldErrors({});
    try {
      const response = await api.post<{ data: AuthResponse }>('/auth/login', values);
      const user = await authenticate(response.data.data.accessToken);
      toast.success(
        t('Welcome back, {{name}}', { name: user.firstName }),
        t('Your live dashboard is ready.'),
      );
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/') ? from : '/dashboard', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setFieldErrors(firstFieldErrors(error));
    }
  });

  const fillDemo = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'PulseDemo2026!', { shouldValidate: true });
  };

  return (
    <AuthLayout
      title={t('Welcome back')}
      subtitle={t('Sign in to see what is happening across your stores right now.')}
      footer={
        <>
          {t('New to PulseBoard?')}{' '}
          <Link
            to="/register"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('Create an account')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError ? <FormAlert>{serverError}</FormAlert> : null}

        <Field
          label={t('Email address')}
          htmlFor="email"
          error={errors.email?.message ?? fieldErrors.email}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            invalid={Boolean(errors.email ?? fieldErrors.email)}
            {...register('email')}
          />
        </Field>

        <Field
          label={t('Password')}
          htmlFor="password"
          error={errors.password?.message ?? fieldErrors.password}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            invalid={Boolean(errors.password ?? fieldErrors.password)}
            {...register('password')}
          />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <Checkbox label={t('Keep me signed in')} {...register('rememberMe')} />
          <Link
            to="/forgot-password"
            className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('Forgot password?')}
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {t('Sign in')}
        </Button>
      </form>

      <div className="mt-6 rounded-2xl border border-dashed border-ink-200 bg-ink-50/70 p-3.5 dark:border-ink-700 dark:bg-ink-900/50">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            {t('Demo workspace')}
          </p>
          {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" /> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account.email)}
              className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
            >
              {t(account.label)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
          {t('Fills the seeded credentials. Password:')}{' '}
          <span className="font-mono">"PulseDemo2026!"</span>
        </p>
      </div>
    </AuthLayout>
  );
}
