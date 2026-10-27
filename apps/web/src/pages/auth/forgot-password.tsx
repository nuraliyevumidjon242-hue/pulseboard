import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { api, getErrorMessage } from '../../lib/api';
import { AuthLayout, FormAlert } from '../../components/auth/auth-layout';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/form';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
});

type ForgotForm = z.infer<typeof schema>;

interface ForgotResponse {
  message: string;
  devToken?: string;
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<ForgotResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const response = await api.post<{ data: ForgotResponse }>('/auth/forgot-password', values);
      setSent(response.data.data);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <AuthLayout
      title={sent ? 'Check your inbox' : 'Reset your password'}
      subtitle={
        sent
          ? 'If an account exists for that email, we have sent a secure reset link. It expires in one hour.'
          : 'Enter the email you use for PulseBoard and we will send you a secure reset link.'
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Reset link sent
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
                  {sent.message}
                </p>
              </div>
            </div>
          </div>

          {sent.devToken ? (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                Development mode
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                Email delivery is disabled locally. Open your reset link directly:
              </p>
              <Link
                to={`/reset-password?token=${sent.devToken}`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 shadow-sm ring-1 ring-amber-200 hover:bg-amber-50 dark:bg-ink-900 dark:text-amber-300 dark:ring-amber-500/30"
              >
                <Mail className="h-3.5 w-3.5" /> Open reset password form
              </Link>
            </div>
          ) : null}

          <Button
            variant="secondary"
            fullWidth
            onClick={() => setSent(null)}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {serverError ? <FormAlert>{serverError}</FormAlert> : null}
          <Field label="Email address" htmlFor="forgot-email" error={errors.email?.message}>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={isSubmitting}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
