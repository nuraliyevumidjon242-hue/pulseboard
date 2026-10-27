import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ShieldAlert, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { api, getErrorMessage } from '../../lib/api';
import { firstFieldErrors } from '../../lib/forms';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from '../../stores/toast-store';
import { AuthLayout, FormAlert } from '../../components/auth/auth-layout';
import { PasswordInput } from '../../components/auth/password-input';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/form';

const schema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
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

type AcceptForm = z.infer<typeof schema>;

interface AcceptResponse {
  user: { firstName: string; lastName: string; email: string };
  accessToken: string;
  expiresIn: number;
  storeId: string;
  storeName: string;
  role: string;
}

export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const authenticate = useAuthStore((state) => state.authenticate);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AcceptForm>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setFieldErrors({});
    try {
      const response = await api.post<{ data: AcceptResponse }>('/invitations/accept', {
        token,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
      });
      const data = response.data.data;
      await authenticate(data.accessToken);
      toast.success(`Welcome to ${data.storeName}`, `You joined as ${data.role}.`);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setFieldErrors(firstFieldErrors(error));
    }
  });

  if (!token) {
    return (
      <AuthLayout
        title="Invitation link is invalid"
        subtitle="This invitation is missing its token."
      >
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <p className="text-sm text-rose-700 dark:text-rose-300">
              Ask a store administrator to send you a fresh invitation. Invitations expire after
              seven days.
            </p>
          </div>
        </div>
        <Button className="mt-5" fullWidth onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Join your team on PulseBoard"
      subtitle="Set up your profile to accept the invitation and start collaborating."
      footer={
        <Link
          to="/login"
          className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          I already have an account
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError ? <FormAlert>{serverError}</FormAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            htmlFor="invite-first"
            error={errors.firstName?.message ?? fieldErrors.firstName}
          >
            <Input
              id="invite-first"
              placeholder="Anna"
              invalid={Boolean(errors.firstName)}
              {...register('firstName')}
            />
          </Field>
          <Field
            label="Last name"
            htmlFor="invite-last"
            error={errors.lastName?.message ?? fieldErrors.lastName}
          >
            <Input
              id="invite-last"
              placeholder="Weber"
              invalid={Boolean(errors.lastName)}
              {...register('lastName')}
            />
          </Field>
        </div>

        <Field
          label="Create a password"
          htmlFor="invite-password"
          error={errors.password?.message ?? fieldErrors.password}
        >
          <PasswordInput
            id="invite-password"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            invalid={Boolean(errors.password ?? fieldErrors.password)}
            {...register('password')}
          />
        </Field>
        <Field
          label="Confirm password"
          htmlFor="invite-confirm"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="invite-confirm"
            autoComplete="new-password"
            placeholder="Repeat password"
            invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={isSubmitting}
          leftIcon={<UserPlus className="h-4 w-4" />}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Accept invitation
        </Button>
      </form>
    </AuthLayout>
  );
}
