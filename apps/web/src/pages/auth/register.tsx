import { ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api, getErrorMessage } from '../../lib/api';
import { firstFieldErrors, localizedZodResolver } from '../../lib/forms';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from '../../stores/toast-store';
import { cn } from '../../lib/utils';
import { CURRENCY_LABELS } from '../../lib/constants';
import type { AuthResponse } from '../../types';
import { AuthLayout, FormAlert } from '../../components/auth/auth-layout';
import { PasswordInput } from '../../components/auth/password-input';
import { Button } from '../../components/ui/button';
import { Checkbox, Field, Input, Select } from '../../components/ui/form';
import { t } from '../../lib/i18n';

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    email: z.string().trim().email('Enter a valid email address'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string(),
    storeName: z.string().trim().min(2, 'Store name must be at least 2 characters').max(255),
    currency: z.string().length(3),
    timezone: z.string().min(1),
    terms: z.literal(true, { message: 'Please accept the terms to continue' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type RegisterForm = z.infer<typeof schema>;

const TIMEZONES = [
  'Europe/Berlin',
  'Europe/London',
  'Europe/Amsterdam',
  'Europe/Paris',
  'Europe/Madrid',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tashkent',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'UZS', 'JPY'];

function strengthOf(password: string): { score: number; label: string; tone: string } {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong', 'Excellent'];
  const tones = [
    'bg-rose-400',
    'bg-rose-400',
    'bg-amber-400',
    'bg-amber-400',
    'bg-emerald-400',
    'bg-emerald-500',
  ];
  return { score, label: labels[score] ?? 'Strong', tone: tones[score] ?? 'bg-emerald-500' };
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const authenticate = useAuthStore((state) => state.authenticate);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: localizedZodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      storeName: '',
      currency: 'EUR',
      timezone: 'Europe/Berlin',
      terms: undefined as unknown as true,
    },
  });

  const password = watch('password');
  const strength = strengthOf(password ?? '');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setFieldErrors({});
    try {
      const response = await api.post<{ data: AuthResponse }>('/auth/register', {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        storeName: values.storeName,
        currency: values.currency,
        timezone: values.timezone,
      });
      await authenticate(response.data.data.accessToken);
      toast.success(
        t('Workspace created'),
        t('Add a product or record your first sale to get going.'),
      );
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setFieldErrors(firstFieldErrors(error));
    }
  });

  return (
    <AuthLayout
      title={t('Start your workspace')}
      subtitle={t('Create your store in under a minute — no credit card, no setup calls.')}
      footer={
        <>
          {t('Already have an account?')}{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('Sign in')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError ? <FormAlert>{serverError}</FormAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('First name')}
            htmlFor="firstName"
            error={errors.firstName?.message ?? fieldErrors.firstName}
          >
            <Input
              id="firstName"
              autoComplete="given-name"
              placeholder="Anna"
              invalid={Boolean(errors.firstName)}
              {...register('firstName')}
            />
          </Field>
          <Field
            label={t('Last name')}
            htmlFor="lastName"
            error={errors.lastName?.message ?? fieldErrors.lastName}
          >
            <Input
              id="lastName"
              autoComplete="family-name"
              placeholder="Weber"
              invalid={Boolean(errors.lastName)}
              {...register('lastName')}
            />
          </Field>
        </div>

        <Field
          label={t('Work email')}
          htmlFor="register-email"
          error={errors.email?.message ?? fieldErrors.email}
        >
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('Password')}
            htmlFor="register-password"
            error={errors.password?.message ?? fieldErrors.password}
          >
            <PasswordInput
              id="register-password"
              autoComplete="new-password"
              placeholder={t('At least 10 characters')}
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>
          <Field
            label={t('Confirm password')}
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder={t('Repeat password')}
              invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </Field>
        </div>

        {password ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    index < strength.score ? strength.tone : 'bg-ink-200 dark:bg-ink-800',
                  )}
                />
              ))}
            </div>
            <span className="text-[10px] font-semibold text-ink-500 dark:text-ink-400">
              {t(strength.label)}
            </span>
          </div>
        ) : null}

        <div className="rounded-2xl border border-ink-200 bg-ink-50/70 p-4 dark:border-ink-700 dark:bg-ink-900/50">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
            {t('Your first store')}
          </p>
          <div className="space-y-3">
            <Field
              label={t('Store name')}
              htmlFor="storeName"
              error={errors.storeName?.message ?? fieldErrors.storeName}
            >
              <Input
                id="storeName"
                placeholder="Kiez Markt"
                invalid={Boolean(errors.storeName)}
                {...register('storeName')}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('Currency')} htmlFor="currency" error={errors.currency?.message}>
                <Select id="currency" {...register('currency')}>
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {t(CURRENCY_LABELS[currency] ?? currency)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('Timezone')} htmlFor="timezone" error={errors.timezone?.message}>
                <Select id="timezone" {...register('timezone')}>
                  {TIMEZONES.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </div>

        <div>
          <Checkbox
            label={t('I agree to the Terms of Service and Privacy Policy')}
            {...register('terms')}
          />
          {errors.terms?.message ? (
            <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
              {errors.terms.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {t('Create workspace')}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-[10px] text-ink-400">
          <Check className="h-3 w-3" /> {t('Free forever plan · No credit card required')}
        </p>
      </form>
    </AuthLayout>
  );
}
