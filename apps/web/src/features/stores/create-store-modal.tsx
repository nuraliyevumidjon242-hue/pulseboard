import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, getErrorMessage } from '../../lib/api';
import { CURRENCIES, CURRENCY_LABELS, TIMEZONES } from '../../lib/constants';
import { firstFieldErrors, localizedZodResolver } from '../../lib/forms';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from '../../stores/toast-store';
import type { Store } from '../../types';
import { Button } from '../../components/ui/button';
import { Field, Input, Select, Textarea } from '../../components/ui/form';
import { FormAlert } from '../../components/auth/auth-layout';
import { Modal } from '../../components/ui/modal';
import { t } from '../../lib/i18n';

const schema = z.object({
  name: z.string().trim().min(2, 'Store name must be at least 2 characters').max(255),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  timezone: z.string().min(1),
  currency: z.string().length(3),
  description: z.string().trim().max(2000).optional(),
});

type StoreForm = z.infer<typeof schema>;

export function CreateStoreModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (store: Store) => void;
}) {
  const queryClient = useQueryClient();
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StoreForm>({
    resolver: localizedZodResolver(schema),
    defaultValues: {
      name: '',
      city: '',
      country: '',
      address: '',
      phone: '',
      email: '',
      timezone: 'Europe/Berlin',
      currency: 'EUR',
      description: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: StoreForm) => {
      const response = await api.post<{ data: { store: Store } }>('/stores', {
        ...values,
        email: values.email || undefined,
      });
      return response.data.data.store;
    },
    onSuccess: async (store) => {
      toast.success(
        t('Store created'),
        t('{{store}} is ready for its first sale.', { store: store.name }),
      );
      await refreshMe();
      void queryClient.invalidateQueries({ queryKey: ['stores'] });
      reset();
      onCreated(store);
      onClose();
    },
    onError: (error) => {
      setServerError(getErrorMessage(error));
      setFieldErrors(firstFieldErrors(error));
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setFieldErrors({});
    mutation.mutate(values);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Add a store')}
      description={t('Create another location and switch between them at any time.')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={onSubmit}
            loading={mutation.isPending}
            leftIcon={<Building2 className="h-4 w-4" />}
          >
            {t('Create store')}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError ? <FormAlert>{serverError}</FormAlert> : null}

        <Field
          label={t('Store name')}
          htmlFor="store-name"
          error={errors.name?.message ?? fieldErrors.name}
        >
          <Input
            id="store-name"
            placeholder="Kiez Markt"
            invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('City')} htmlFor="store-city">
            <Input id="store-city" placeholder={t('Berlin')} {...register('city')} />
          </Field>
          <Field label={t('Country')} htmlFor="store-country">
            <Input id="store-country" placeholder={t('Germany')} {...register('country')} />
          </Field>
        </div>

        <Field label={t('Street address')} htmlFor="store-address">
          <Input id="store-address" placeholder="Warschauer Str. 12" {...register('address')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Currency')} htmlFor="store-currency">
            <Select id="store-currency" {...register('currency')}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {t(CURRENCY_LABELS[currency] ?? currency)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Timezone')} htmlFor="store-timezone">
            <Select id="store-timezone" {...register('timezone')}>
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Phone')} htmlFor="store-phone">
            <Input id="store-phone" placeholder="+49 30 123456" {...register('phone')} />
          </Field>
          <Field label={t('Contact email')} htmlFor="store-email" error={errors.email?.message}>
            <Input
              id="store-email"
              type="email"
              placeholder="hello@kiezmarkt.de"
              {...register('email')}
            />
          </Field>
        </div>

        <Field label={t('Description')} htmlFor="store-description">
          <Textarea
            id="store-description"
            rows={2}
            placeholder={t('A short description of this location')}
            {...register('description')}
          />
        </Field>

        <p className="rounded-xl bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-950/40 dark:text-ink-400">
          {t(
            'You will be the owner and administrator of this store. Currency and timezone control how revenue and daily reports are calculated.',
          )}
        </p>
      </form>
    </Modal>
  );
}
