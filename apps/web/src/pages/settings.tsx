import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BellRing,
  Building2,
  CheckCircle2,
  Clock3,
  Globe2,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Package,
  Palette,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { FormAlert } from '../components/auth/auth-layout';
import { PasswordInput } from '../components/auth/password-input';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, PageHeader } from '../components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/feedback';
import { Checkbox, Field, Input, Select, Switch, Textarea } from '../components/ui/form';
import { ConfirmDialog, Modal } from '../components/ui/modal';
import { Tabs } from '../components/ui/tabs';
import { useStoreDetails } from '../hooks/api';
import { usePageTitle } from '../hooks/use-utils';
import { useCan, useStoreContext } from '../hooks/use-store-context';
import { api, getErrorMessage } from '../lib/api';
import { CURRENCIES, CURRENCY_LABELS, REFRESH_OPTIONS, TIMEZONES } from '../lib/constants';
import { firstFieldErrors } from '../lib/forms';
import { ROLE_LABELS } from '../lib/permissions';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { useAuthStore } from '../stores/auth-store';
import { toast } from '../stores/toast-store';
import { useUiStore } from '../stores/ui-store';
import type { Preferences, Theme, User } from '../types';

const TABS = [
  { id: 'profile', label: 'Profile', icon: <UserRound className="h-4 w-4" /> },
  { id: 'store', label: 'Store', icon: <Building2 className="h-4 w-4" /> },
  { id: 'preferences', label: 'Preferences', icon: <Palette className="h-4 w-4" /> },
  { id: 'security', label: 'Security', icon: <ShieldCheck className="h-4 w-4" /> },
] as const;

type SettingsTab = (typeof TABS)[number]['id'];

const profileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  phone: z
    .string()
    .trim()
    .max(32, 'Phone is too long')
    .regex(/^[+()\d\s-]*$/, 'Phone contains invalid characters'),
  avatarUrl: z.string().trim().url('Enter a valid image URL').or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

const storeSchema = z.object({
  name: z.string().trim().min(2, 'Store name must be at least 2 characters').max(255),
  city: z.string().trim().max(100),
  country: z.string().trim().max(100),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(32),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  description: z.string().trim().max(2000),
  logoUrl: z.string().trim().url('Enter a valid image URL').or(z.literal('')),
  timezone: z.string().min(1, 'Choose a timezone'),
  currency: z.string().length(3, 'Choose a currency'),
  receiptPrefix: z
    .string()
    .trim()
    .min(1, 'Prefix is required')
    .max(10, 'Keep it under 10 characters')
    .regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers and dashes only'),
  lowStockEmails: z.boolean(),
  milestoneAmount: z
    .number({ error: 'Enter a milestone amount' })
    .min(0, 'Milestone cannot be negative')
    .max(1_000_000_000, 'Milestone is too large'),
  dataRetentionDays: z
    .number({ error: 'Enter a retention period' })
    .int('Use whole days')
    .min(0, 'Cannot be negative')
    .max(3650, 'Keep it under 10 years'),
});

type StoreForm = z.infer<typeof storeSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(128, 'Password is too long')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type PasswordForm = z.infer<typeof passwordSchema>;

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 dark:text-ink-500">
      {children}
    </p>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-ink-100 py-2.5 last:border-0 dark:border-ink-800">
      <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{label}</span>
      <span className="text-right text-xs font-semibold text-ink-800 dark:text-ink-100">
        {value}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  usePageTitle('Settings');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { storeId, store } = useStoreContext();
  const user = useAuthStore((state) => state.user);
  const preferences = useAuthStore((state) => state.preferences);
  const setPreferences = useAuthStore((state) => state.setPreferences);
  const setUser = useAuthStore((state) => state.setUser);
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const logout = useAuthStore((state) => state.logout);
  const setTheme = useUiStore((state) => state.setTheme);
  const canManageSettings = useCan('settings:write');

  const requestedTab = (searchParams.get('tab') ?? 'profile') as SettingsTab;
  const activeTab: SettingsTab = TABS.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : 'profile';

  const changeTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const detailsQuery = useStoreDetails(storeId);
  const storeDetails = detailsQuery.data?.store;
  const isOwner = detailsQuery.data?.isOwner ?? false;
  const currency = storeDetails?.currency ?? store?.currency ?? 'EUR';

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [signOutAllOpen, setSignOutAllOpen] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [themeChoice, setThemeChoice] = useState<Theme>(preferences?.theme ?? 'system');
  const [refreshChoice, setRefreshChoice] = useState(preferences?.autoRefreshInterval ?? 0);
  const [notificationsChoice, setNotificationsChoice] = useState(
    preferences?.notificationsEnabled ?? true,
  );

  const profileDefaults = useMemo<ProfileForm>(
    () => ({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    }),
    [user],
  );

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: profileDefaults,
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    profileForm.reset(profileDefaults);
  }, [profileDefaults, profileForm]);

  const storeForm = useForm<StoreForm>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: '',
      city: '',
      country: '',
      address: '',
      phone: '',
      email: '',
      description: '',
      logoUrl: '',
      timezone: 'Europe/Berlin',
      currency: 'EUR',
      receiptPrefix: 'PB',
      lowStockEmails: true,
      milestoneAmount: 1000,
      dataRetentionDays: 365,
    },
  });
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeFieldErrors, setStoreFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!storeDetails) return;
    storeForm.reset({
      name: storeDetails.name,
      city: storeDetails.city ?? '',
      country: storeDetails.country ?? '',
      address: storeDetails.address ?? '',
      phone: storeDetails.phone ?? '',
      email: storeDetails.email ?? '',
      description: storeDetails.description ?? '',
      logoUrl: storeDetails.logoUrl ?? '',
      timezone: storeDetails.timezone,
      currency: storeDetails.currency,
      receiptPrefix: storeDetails.settings?.receiptPrefix ?? 'PB',
      lowStockEmails: storeDetails.settings?.lowStockEmails ?? true,
      milestoneAmount: storeDetails.settings?.milestoneAmount ?? 1000,
      dataRetentionDays: storeDetails.settings?.dataRetentionDays ?? 365,
    });
  }, [storeDetails, storeForm]);

  useEffect(() => {
    if (!preferences) return;
    setThemeChoice(preferences.theme);
    setRefreshChoice(preferences.autoRefreshInterval);
    setNotificationsChoice(preferences.notificationsEnabled);
  }, [preferences]);

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const response = await api.patch<{ data: { user: User } }>('/auth/me', values);
      return response.data.data.user;
    },
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Profile updated', 'Your details are now up to date.');
    },
    onError: (error) => {
      setProfileError(getErrorMessage(error));
      setProfileFieldErrors(firstFieldErrors(error));
    },
  });

  const storeMutation = useMutation({
    mutationFn: async (values: StoreForm) => {
      if (!storeId) throw new Error('No store selected');
      await api.patch(`/stores/${storeId}`, {
        name: values.name,
        city: values.city,
        country: values.country,
        address: values.address,
        phone: values.phone,
        email: values.email,
        description: values.description,
        logoUrl: values.logoUrl,
        timezone: values.timezone,
        currency: values.currency,
        settings: {
          receiptPrefix: values.receiptPrefix,
          lowStockEmails: values.lowStockEmails,
          milestoneAmount: values.milestoneAmount,
          dataRetentionDays: values.dataRetentionDays,
        },
      });
    },
    onSuccess: async () => {
      toast.success('Store settings saved', 'New sales and reports will use these settings.');
      await refreshMe();
      if (storeId) {
        void queryClient.invalidateQueries({ queryKey: ['store', storeId] });
        void queryClient.invalidateQueries({ queryKey: ['stores'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
      setStoreError(null);
      setStoreFieldErrors({});
    },
    onError: (error) => {
      setStoreError(getErrorMessage(error));
      setStoreFieldErrors(firstFieldErrors(error));
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const passwordMutation = useMutation({
    mutationFn: async (values: PasswordForm) => {
      await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
    },
    onSuccess: () => {
      passwordForm.reset();
      setPasswordError(null);
      toast.success('Password changed', 'Use your new password the next time you sign in.');
    },
    onError: (error) => setPasswordError(getErrorMessage(error)),
  });

  const preferencesMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put<{ data: { preferences: Preferences } }>('/user/preferences', {
        theme: themeChoice,
        autoRefreshInterval: refreshChoice,
        notificationsEnabled: notificationsChoice,
      });
      return response.data.data.preferences;
    },
    onSuccess: (updated) => {
      setPreferences(updated);
      setTheme(updated.theme);
      setPreferenceError(null);
      toast.success('Preferences saved', 'Your workspace will remember these choices.');
    },
    onError: (error) => setPreferenceError(getErrorMessage(error)),
  });

  const signOutAllMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout-all');
    },
    onSuccess: async () => {
      await logout();
      navigate('/login', { replace: true });
      toast.success('Signed out everywhere', 'All refresh sessions have been revoked.');
    },
    onError: (error) => toast.error('Could not revoke sessions', getErrorMessage(error)),
  });

  const deleteStoreMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error('No store selected');
      await api.delete(`/stores/${storeId}`);
    },
    onSuccess: async () => {
      toast.success('Store deleted', `${storeDetails?.name ?? 'The store'} has been removed.`);
      setDeleteOpen(false);
      await refreshMe();
      void queryClient.invalidateQueries({ queryKey: ['stores'] });
      navigate('/stores', { replace: true });
    },
    onError: (error) => toast.error('Could not delete store', getErrorMessage(error)),
  });

  const onProfileSubmit = profileForm.handleSubmit((values) => {
    setProfileError(null);
    setProfileFieldErrors({});
    profileMutation.mutate({
      ...values,
      phone: values.phone.trim(),
      avatarUrl: values.avatarUrl.trim(),
    });
  });

  const onStoreSubmit = storeForm.handleSubmit((values) => {
    setStoreError(null);
    setStoreFieldErrors({});
    storeMutation.mutate(values);
  });

  const onPasswordSubmit = passwordForm.handleSubmit((values) => {
    setPasswordError(null);
    passwordMutation.mutate(values);
  });

  const profileDirty = profileForm.formState.isDirty;
  const storeDirty = storeForm.formState.isDirty;
  const preferencesDirty =
    themeChoice !== (preferences?.theme ?? 'system') ||
    refreshChoice !== (preferences?.autoRefreshInterval ?? 0) ||
    notificationsChoice !== (preferences?.notificationsEnabled ?? true);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage your personal profile, store configuration, dashboard preferences and account security."
        actions={
          <Badge tone="brand">
            <ShieldCheck className="h-3.5 w-3.5" />
            {user ? ROLE_LABELS[store?.role ?? 'viewer'] : 'Member'}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Card className="overflow-hidden">
            <Tabs tabs={[...TABS]} active={activeTab} onChange={changeTab} />
            <div className="p-5 sm:p-6">
              {activeTab === 'profile' ? (
                <div className="space-y-6">
                  <CardHeader
                    className="-mx-5 -mt-5 mb-5 border-ink-100 px-5 pt-0 dark:border-ink-800 sm:-mx-6 sm:-mt-6 sm:px-6"
                    title="Profile information"
                    description="This is how teammates see you across every store."
                  />
                  <form onSubmit={onProfileSubmit} className="space-y-5" noValidate>
                    {profileError ? <FormAlert>{profileError}</FormAlert> : null}

                    <div className="flex flex-col gap-4 rounded-2xl border border-ink-100 bg-ink-50/60 p-4 dark:border-ink-800 dark:bg-ink-950/30 sm:flex-row sm:items-center">
                      <Avatar
                        firstName={user?.firstName}
                        lastName={user?.lastName}
                        src={user?.avatarUrl}
                        className="h-16 w-16 text-lg"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink-900 dark:text-white">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                          {user?.email}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-400">
                          Member since{' '}
                          {formatDate(user?.createdAt, 'UTC', { month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="First name"
                        htmlFor="profile-first-name"
                        required
                        error={
                          profileForm.formState.errors.firstName?.message ??
                          profileFieldErrors.firstName
                        }
                      >
                        <Input
                          id="profile-first-name"
                          autoComplete="given-name"
                          invalid={Boolean(profileForm.formState.errors.firstName)}
                          {...profileForm.register('firstName')}
                        />
                      </Field>
                      <Field
                        label="Last name"
                        htmlFor="profile-last-name"
                        required
                        error={
                          profileForm.formState.errors.lastName?.message ??
                          profileFieldErrors.lastName
                        }
                      >
                        <Input
                          id="profile-last-name"
                          autoComplete="family-name"
                          invalid={Boolean(profileForm.formState.errors.lastName)}
                          {...profileForm.register('lastName')}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Email address"
                        htmlFor="profile-email"
                        hint="Email changes require support verification."
                      >
                        <Input id="profile-email" value={user?.email ?? ''} disabled readOnly />
                      </Field>
                      <Field
                        label="Phone"
                        htmlFor="profile-phone"
                        error={
                          profileForm.formState.errors.phone?.message ?? profileFieldErrors.phone
                        }
                      >
                        <Input
                          id="profile-phone"
                          autoComplete="tel"
                          placeholder="+49 30 123456"
                          {...profileForm.register('phone')}
                        />
                      </Field>
                    </div>

                    <Field
                      label="Avatar URL"
                      htmlFor="profile-avatar"
                      hint="Paste a square image URL. Leave empty to use your initials."
                      error={
                        profileForm.formState.errors.avatarUrl?.message ??
                        profileFieldErrors.avatarUrl
                      }
                    >
                      <Input
                        id="profile-avatar"
                        type="url"
                        placeholder="https://example.com/avatar.jpg"
                        {...profileForm.register('avatarUrl')}
                      />
                    </Field>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => profileForm.reset(profileDefaults)}
                        disabled={!profileDirty || profileMutation.isPending}
                      >
                        Discard
                      </Button>
                      <Button
                        type="submit"
                        loading={profileMutation.isPending}
                        disabled={!profileDirty}
                        leftIcon={<CheckCircle2 className="h-4 w-4" />}
                      >
                        Save profile
                      </Button>
                    </div>
                  </form>
                </div>
              ) : null}

              {activeTab === 'store' ? (
                !storeId ? (
                  <EmptyState
                    title="No store selected"
                    description="Create or join a store before configuring location settings."
                    icon={<Building2 className="h-6 w-6" />}
                    action={
                      <Button
                        size="sm"
                        onClick={() => navigate('/stores')}
                        rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                      >
                        Go to stores
                      </Button>
                    }
                  />
                ) : detailsQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : detailsQuery.isError ? (
                  <ErrorState
                    message="Could not load this store's settings."
                    onRetry={() => void detailsQuery.refetch()}
                  />
                ) : storeDetails ? (
                  <div className="space-y-6">
                    <CardHeader
                      className="-mx-5 -mt-5 mb-5 border-ink-100 px-5 pt-0 dark:border-ink-800 sm:-mx-6 sm:-mt-6 sm:px-6"
                      title="Store configuration"
                      description="Currency, timezone and receipt rules apply to every new transaction."
                      action={
                        <Badge tone={canManageSettings ? 'success' : 'neutral'}>
                          {canManageSettings ? 'Editable' : 'Read only'}
                        </Badge>
                      }
                    />

                    {!canManageSettings ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        Only store administrators can change these settings. Ask an owner or admin
                        if something needs updating.
                      </div>
                    ) : null}

                    {canManageSettings ? (
                      <form onSubmit={onStoreSubmit} className="space-y-6" noValidate>
                        {storeError ? <FormAlert>{storeError}</FormAlert> : null}

                        <section>
                          <SectionLabel>Identity</SectionLabel>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                              label="Store name"
                              htmlFor="store-name"
                              required
                              className="sm:col-span-2"
                              error={
                                storeForm.formState.errors.name?.message ?? storeFieldErrors.name
                              }
                            >
                              <Input
                                id="store-name"
                                invalid={Boolean(storeForm.formState.errors.name)}
                                {...storeForm.register('name')}
                              />
                            </Field>
                            <Field label="Phone" htmlFor="store-phone">
                              <Input
                                id="store-phone"
                                placeholder="+49 30 123456"
                                {...storeForm.register('phone')}
                              />
                            </Field>
                            <Field
                              label="Contact email"
                              htmlFor="store-email"
                              error={
                                storeForm.formState.errors.email?.message ?? storeFieldErrors.email
                              }
                            >
                              <Input
                                id="store-email"
                                type="email"
                                placeholder="hello@yourstore.com"
                                {...storeForm.register('email')}
                              />
                            </Field>
                            <Field label="Logo URL" htmlFor="store-logo" className="sm:col-span-2">
                              <Input
                                id="store-logo"
                                type="url"
                                placeholder="https://yourstore.com/logo.png"
                                {...storeForm.register('logoUrl')}
                              />
                            </Field>
                            <Field
                              label="Description"
                              htmlFor="store-description"
                              className="sm:col-span-2"
                            >
                              <Textarea
                                id="store-description"
                                rows={2}
                                placeholder="A short description shown on receipts and reports"
                                {...storeForm.register('description')}
                              />
                            </Field>
                          </div>
                        </section>

                        <section>
                          <SectionLabel>Location & locale</SectionLabel>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                              label="Street address"
                              htmlFor="store-address"
                              className="sm:col-span-2"
                            >
                              <Input
                                id="store-address"
                                placeholder="Warschauer Str. 12"
                                {...storeForm.register('address')}
                              />
                            </Field>
                            <Field label="City" htmlFor="store-city">
                              <Input
                                id="store-city"
                                placeholder="Berlin"
                                {...storeForm.register('city')}
                              />
                            </Field>
                            <Field label="Country" htmlFor="store-country">
                              <Input
                                id="store-country"
                                placeholder="Germany"
                                {...storeForm.register('country')}
                              />
                            </Field>
                            <Field label="Timezone" htmlFor="store-timezone">
                              <Select id="store-timezone" {...storeForm.register('timezone')}>
                                {TIMEZONES.map((timezone) => (
                                  <option key={timezone} value={timezone}>
                                    {timezone}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field
                              label="Currency"
                              htmlFor="store-currency"
                              hint="Changing currency does not convert historical amounts."
                            >
                              <Select id="store-currency" {...storeForm.register('currency')}>
                                {CURRENCIES.map((code) => (
                                  <option key={code} value={code}>
                                    {CURRENCY_LABELS[code] ?? code}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                          </div>
                        </section>

                        <section>
                          <SectionLabel>Operations</SectionLabel>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                              label="Receipt prefix"
                              htmlFor="store-receipt-prefix"
                              hint="Used for transaction IDs, e.g. KIEZ-000142."
                              error={storeForm.formState.errors.receiptPrefix?.message}
                            >
                              <Input
                                id="store-receipt-prefix"
                                className="uppercase"
                                maxLength={10}
                                {...storeForm.register('receiptPrefix')}
                              />
                            </Field>
                            <Field
                              label="Milestone amount"
                              htmlFor="store-milestone"
                              hint={`Celebrate a live milestone after ${formatCurrency(storeForm.watch('milestoneAmount') || 0, currency)} in daily revenue.`}
                              error={storeForm.formState.errors.milestoneAmount?.message}
                            >
                              <Input
                                id="store-milestone"
                                type="number"
                                min={0}
                                step="0.01"
                                leftIcon={<Wallet className="h-4 w-4" />}
                                {...storeForm.register('milestoneAmount', { valueAsNumber: true })}
                              />
                            </Field>
                            <Field
                              label="Data retention"
                              htmlFor="store-retention"
                              hint="Historical analytics older than this are archived. 0 keeps everything."
                              error={storeForm.formState.errors.dataRetentionDays?.message}
                            >
                              <Input
                                id="store-retention"
                                type="number"
                                min={0}
                                max={3650}
                                leftIcon={<Clock3 className="h-4 w-4" />}
                                {...storeForm.register('dataRetentionDays', {
                                  valueAsNumber: true,
                                })}
                              />
                            </Field>
                            <div className="flex items-end pb-1">
                              <Checkbox
                                label="Email me low-stock alerts"
                                description="Daily digest when items fall below their minimum stock."
                                {...storeForm.register('lowStockEmails')}
                              />
                            </div>
                          </div>
                        </section>

                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => storeForm.reset()}
                            disabled={!storeDirty || storeMutation.isPending}
                          >
                            Discard changes
                          </Button>
                          <Button
                            type="submit"
                            loading={storeMutation.isPending}
                            disabled={!storeDirty}
                            leftIcon={<CheckCircle2 className="h-4 w-4" />}
                          >
                            Save store settings
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <ReadOnlyRow label="Store name" value={storeDetails.name} />
                        <ReadOnlyRow
                          label="Location"
                          value={
                            [storeDetails.address, storeDetails.city, storeDetails.country]
                              .filter(Boolean)
                              .join(', ') || 'Not set'
                          }
                        />
                        <ReadOnlyRow label="Timezone" value={storeDetails.timezone} />
                        <ReadOnlyRow label="Currency" value={storeDetails.currency} />
                        <ReadOnlyRow
                          label="Receipt prefix"
                          value={storeDetails.settings?.receiptPrefix ?? 'PB'}
                        />
                        <ReadOnlyRow
                          label="Low-stock emails"
                          value={storeDetails.settings?.lowStockEmails ? 'Enabled' : 'Disabled'}
                        />
                        <ReadOnlyRow
                          label="Data retention"
                          value={
                            storeDetails.settings?.dataRetentionDays
                              ? `${storeDetails.settings.dataRetentionDays} days`
                              : 'Keep everything'
                          }
                        />
                      </div>
                    )}

                    {isOwner ? (
                      <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-500/30 dark:bg-rose-500/5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="flex items-center gap-1.5 text-sm font-bold text-rose-700 dark:text-rose-300">
                              <Trash2 className="h-4 w-4" /> Delete this store
                            </p>
                            <p className="mt-1 max-w-md text-xs leading-relaxed text-rose-600/90 dark:text-rose-300/80">
                              Permanently removes products, sales, inventory history and team access
                              for <span className="font-semibold">{storeDetails.name}</span>. This
                              cannot be undone.
                            </p>
                          </div>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setDeleteConfirmation('');
                              setDeleteOpen(true);
                            }}
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          >
                            Delete store
                          </Button>
                        </div>
                      </section>
                    ) : null}
                  </div>
                ) : null
              ) : null}

              {activeTab === 'preferences' ? (
                <div className="space-y-6">
                  <CardHeader
                    className="-mx-5 -mt-5 mb-5 border-ink-100 px-5 pt-0 dark:border-ink-800 sm:-mx-6 sm:-mt-6 sm:px-6"
                    title="Dashboard preferences"
                    description="Personal choices that follow your account across devices."
                  />
                  {preferenceError ? <FormAlert>{preferenceError}</FormAlert> : null}

                  <section>
                    <SectionLabel>Appearance</SectionLabel>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {THEME_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const selected = themeChoice === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setThemeChoice(option.value);
                              setTheme(option.value);
                            }}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                              selected
                                ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-brand-500/10'
                                : 'border-ink-200 bg-white hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-ink-600',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-lg',
                                selected
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300',
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block text-xs font-semibold text-ink-900 dark:text-white">
                                {option.label}
                              </span>
                              <span className="block text-[10px] text-ink-500 dark:text-ink-400">
                                {option.value === 'system'
                                  ? 'Match your device'
                                  : `Always ${option.value}`}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-4 border-t border-ink-100 pt-5 dark:border-ink-800">
                    <SectionLabel>Live data</SectionLabel>
                    <Field
                      label="Auto-refresh dashboard"
                      htmlFor="pref-refresh"
                      hint="Realtime sales still stream instantly over the socket; this controls full refreshes."
                    >
                      <Select
                        id="pref-refresh"
                        value={refreshChoice}
                        onChange={(event) => setRefreshChoice(Number(event.target.value))}
                      >
                        {REFRESH_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-[11px] text-ink-500 dark:bg-ink-950/40 dark:text-ink-400">
                      <RefreshCw className="h-3.5 w-3.5" />
                      {refreshChoice === 0
                        ? 'Manual refresh only.'
                        : `Dashboard refreshes every ${refreshChoice}s while open.`}
                    </div>
                  </section>

                  <section className="space-y-4 border-t border-ink-100 pt-5 dark:border-ink-800">
                    <SectionLabel>Notifications</SectionLabel>
                    <div className="rounded-xl border border-ink-200 p-4 dark:border-ink-800">
                      <Switch
                        checked={notificationsChoice}
                        onChange={setNotificationsChoice}
                        label="In-app notifications"
                        description="Low-stock alerts, milestone celebrations and important account updates."
                      />
                    </div>
                    <div className="flex items-start gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-[11px] text-ink-500 dark:bg-ink-950/40 dark:text-ink-400">
                      <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Turning this off hides the notifications menu but keeps your order history
                      intact.
                    </div>
                  </section>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!preferencesDirty || preferencesMutation.isPending}
                      onClick={() => {
                        const previous = preferences?.theme ?? 'system';
                        setThemeChoice(previous);
                        setRefreshChoice(preferences?.autoRefreshInterval ?? 0);
                        setNotificationsChoice(preferences?.notificationsEnabled ?? true);
                        setTheme(previous);
                      }}
                    >
                      Discard
                    </Button>
                    <Button
                      onClick={() => preferencesMutation.mutate()}
                      loading={preferencesMutation.isPending}
                      disabled={!preferencesDirty}
                      leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      Save preferences
                    </Button>
                  </div>
                </div>
              ) : null}

              {activeTab === 'security' ? (
                <div className="space-y-6">
                  <CardHeader
                    className="-mx-5 -mt-5 mb-5 border-ink-100 px-5 pt-0 dark:border-ink-800 sm:-mx-6 sm:-mt-6 sm:px-6"
                    title="Account security"
                    description="Protect your account with a strong password and by closing unused sessions."
                  />

                  <form onSubmit={onPasswordSubmit} className="space-y-4" noValidate>
                    {passwordError ? <FormAlert>{passwordError}</FormAlert> : null}
                    <Field
                      label="Current password"
                      htmlFor="current-password"
                      required
                      error={passwordForm.formState.errors.currentPassword?.message}
                    >
                      <PasswordInput
                        id="current-password"
                        autoComplete="current-password"
                        invalid={Boolean(passwordForm.formState.errors.currentPassword)}
                        {...passwordForm.register('currentPassword')}
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="New password"
                        htmlFor="new-password"
                        required
                        hint="At least 10 characters with a letter and a number."
                        error={passwordForm.formState.errors.newPassword?.message}
                      >
                        <PasswordInput
                          id="new-password"
                          autoComplete="new-password"
                          invalid={Boolean(passwordForm.formState.errors.newPassword)}
                          {...passwordForm.register('newPassword')}
                        />
                      </Field>
                      <Field
                        label="Confirm new password"
                        htmlFor="confirm-password"
                        required
                        error={passwordForm.formState.errors.confirmPassword?.message}
                      >
                        <PasswordInput
                          id="confirm-password"
                          autoComplete="new-password"
                          invalid={Boolean(passwordForm.formState.errors.confirmPassword)}
                          {...passwordForm.register('confirmPassword')}
                        />
                      </Field>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        type="submit"
                        loading={passwordMutation.isPending}
                        leftIcon={<KeyRound className="h-4 w-4" />}
                      >
                        Update password
                      </Button>
                    </div>
                  </form>

                  <section className="border-t border-ink-100 pt-5 dark:border-ink-800">
                    <SectionLabel>Sessions</SectionLabel>
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ink-200 p-4 dark:border-ink-800">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                          <Lock className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink-900 dark:text-white">
                            Sign out of all devices
                          </p>
                          <p className="mt-0.5 max-w-sm text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                            Revokes every refresh token for your account. Other browsers and phones
                            will need to sign in again.
                          </p>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setSignOutAllOpen(true)}>
                        Sign out everywhere
                      </Button>
                    </div>
                  </section>

                  <section className="border-t border-ink-100 pt-5 dark:border-ink-800">
                    <SectionLabel>How we protect your account</SectionLabel>
                    <ul className="space-y-2.5 text-xs text-ink-600 dark:text-ink-300">
                      {[
                        'Short-lived access tokens are kept in memory, never in local storage.',
                        'Refresh tokens rotate on every use and are stored hashed on the server.',
                        'Reusing an old refresh token revokes every active session automatically.',
                        'Sensitive actions are rate-limited and written to the activity log.',
                      ].map((tip) => (
                        <li key={tip} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 via-brand-500 to-cyan-500 px-5 py-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
                Current workspace
              </p>
              <p className="mt-1 truncate text-base font-bold">
                {store?.name ?? 'No store selected'}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/80">
                <MapPin className="h-3 w-3" />
                {[store?.city, store?.country].filter(Boolean).join(', ') || 'Location not set'}
              </p>
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-ink-500 dark:text-ink-400">
                  <Globe2 className="h-3.5 w-3.5" /> Timezone
                </span>
                <span className="font-semibold text-ink-800 dark:text-ink-100">
                  {store?.timezone ?? 'UTC'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-ink-500 dark:text-ink-400">
                  <Wallet className="h-3.5 w-3.5" /> Currency
                </span>
                <span className="font-semibold text-ink-800 dark:text-ink-100">
                  {store?.currency ?? 'EUR'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-ink-500 dark:text-ink-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Your role
                </span>
                <Badge tone="brand">{ROLE_LABELS[store?.role ?? 'viewer']}</Badge>
              </div>
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => navigate('/stores')}
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Manage stores
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-900 dark:text-white">
                  <ShoppingBag className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                  Quick links
                </p>
                <p className="mt-0.5 text-[11px] text-ink-500 dark:text-ink-400">
                  Jump straight into your daily workflow.
                </p>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Record a new sale', to: '/sales?new=1', icon: ShoppingBag },
                  { label: 'Review inventory', to: '/inventory', icon: Package },
                  { label: 'Team & invitations', to: '/team', icon: UserRound },
                  { label: 'Export analytics', to: '/analytics', icon: Globe2 },
                ].map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.label}
                      type="button"
                      onClick={() => navigate(link.to)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-ink-600 transition hover:bg-ink-50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">{link.label}</span>
                      <ArrowRight className="h-3 w-3 opacity-50" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="rounded-2xl border border-ink-200 bg-ink-50/60 p-4 dark:border-ink-800 dark:bg-ink-900/40">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-600 dark:text-ink-300">
              <Mail className="h-3.5 w-3.5" /> Need a hand?
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
              Email{' '}
              <span className="font-semibold text-ink-700 dark:text-ink-200">
                support@pulseboard.app
              </span>{' '}
              and our team will get back to you within one business day.
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={signOutAllOpen}
        onClose={() => setSignOutAllOpen(false)}
        onConfirm={() => signOutAllMutation.mutate()}
        title="Sign out of all devices?"
        description="Every refresh token for your account will be revoked immediately."
        confirmLabel="Sign out everywhere"
        destructive
        loading={signOutAllMutation.isPending}
      />

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteConfirmation('');
        }}
        title="Delete this store?"
        description="Products, sales, inventory history and team access will be permanently removed."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirmation('');
              }}
              disabled={deleteStoreMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteStoreMutation.mutate()}
              loading={deleteStoreMutation.isPending}
              disabled={deleteConfirmation !== (storeDetails?.name ?? '')}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Delete store
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Type{' '}
            <span className="font-semibold text-ink-900 dark:text-white">{storeDetails?.name}</span>{' '}
            to confirm. This action cannot be undone.
          </p>
          <Input
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            placeholder={storeDetails?.name ?? 'Store name'}
            aria-label="Store name confirmation"
            autoComplete="off"
          />
        </div>
      </Modal>
    </div>
  );
}
