import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Mail, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/ui/card';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState, ErrorState, SkeletonTable } from '../components/ui/feedback';
import { Select } from '../components/ui/form';
import { Tabs } from '../components/ui/tabs';
import { DataCard, Pagination, Table, TableRow, Td, Th } from '../components/ui/table';
import { ConfirmDialog } from '../components/ui/modal';
import { InviteMemberModal } from '../features/team/invite-member-modal';
import { useActivity, useInvitations, useTeam } from '../hooks/api';
import { useStoreContext } from '../hooks/use-store-context';
import { usePageTitle } from '../hooks/use-utils';
import { api, getErrorMessage } from '../lib/api';
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/permissions';
import { activityLabel, formatDate, formatDateTime, relativeTime, titleCase } from '../lib/utils';
import { toast } from '../stores/toast-store';
import { useAuthStore } from '../stores/auth-store';
import type { StoreRole, TeamMember } from '../types';

export default function TeamPage() {
  usePageTitle('Team');
  const queryClient = useQueryClient();
  const { storeId, role, timezone } = useStoreContext();
  const currentUser = useAuthStore((state) => state.user);
  const [tab, setTab] = useState('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [activityPage, setActivityPage] = useState(1);

  const canManage = can(role, 'team:manage');
  const canSeeActivity = can(role, 'activity:read');

  const teamQuery = useTeam(storeId);
  const invitationsQuery = useInvitations(storeId);
  const activityQuery = useActivity(canSeeActivity ? storeId : null, {
    page: activityPage,
    limit: 15,
  });

  const members = teamQuery.data?.data ?? [];
  const invitations = invitationsQuery.data?.data ?? [];
  const pendingInvitations = invitations.filter((invitation) => invitation.status === 'pending');
  const admins = members.filter((member) => member.role === 'admin').length;

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: StoreRole }) =>
      api.put(`/stores/${storeId}/team/${userId}/role`, { role: newRole }),
    onSuccess: () => {
      toast.success('Role updated', 'Permissions take effect on their next request.');
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
    onError: (error) => toast.error('Could not update role', getErrorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (member: TeamMember) => api.delete(`/stores/${storeId}/team/${member.userId}`),
    onSuccess: () => {
      toast.success('Member removed', 'They no longer have access to this store.');
      void queryClient.invalidateQueries({ queryKey: ['team'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
      setRemoveTarget(null);
    },
    onError: (error) => toast.error('Could not remove member', getErrorMessage(error)),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="People & access"
        title="Team"
        description="Control who can see and change your store — with precise, role-based permissions."
        actions={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
              Invite member
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                Team members
              </p>
              <p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">
                {members.length}
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <Users className="h-4 w-4" />
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                Administrators
              </p>
              <p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{admins}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">
                Pending invites
              </p>
              <p className="mt-1 text-xl font-bold text-ink-900 dark:text-white">
                {pendingInvitations.length}
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
              <Mail className="h-4 w-4" />
            </span>
          </div>
        </Card>
      </div>

      <DataCard>
        <Tabs
          active={tab}
          onChange={setTab}
          className="px-3 pt-1"
          tabs={[
            {
              id: 'members',
              label: 'Members',
              icon: <Users className="h-4 w-4" />,
              badge: members.length,
            },
            {
              id: 'invitations',
              label: 'Invitations',
              icon: <Mail className="h-4 w-4" />,
              badge: pendingInvitations.length,
            },
            ...(canSeeActivity
              ? [{ id: 'activity', label: 'Activity log', icon: <Activity className="h-4 w-4" /> }]
              : []),
          ]}
        />

        {tab === 'members' ? (
          teamQuery.isLoading ? (
            <SkeletonTable rows={5} columns={4} />
          ) : teamQuery.isError ? (
            <ErrorState
              message={getErrorMessage(teamQuery.error)}
              onRetry={() => void teamQuery.refetch()}
            />
          ) : members.length === 0 ? (
            <EmptyState
              title="No team members yet"
              description="Invite a manager or cashier to collaborate on this store."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setInviteOpen(true)}>
                    Invite member
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                  <Th>Last active</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.userId === currentUser?.id;
                  return (
                    <TableRow key={member.userId}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            firstName={member.firstName}
                            lastName={member.lastName}
                            src={member.avatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-ink-800 dark:text-ink-100">
                              {member.firstName} {member.lastName}
                              {member.isOwner ? <Badge tone="brand">Owner</Badge> : null}
                              {isSelf ? <Badge tone="neutral">You</Badge> : null}
                            </p>
                            <p className="truncate text-[10px] text-ink-400">{member.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {canManage && !member.isOwner && !isSelf ? (
                          <Select
                            value={member.role}
                            onChange={(event) =>
                              roleMutation.mutate({
                                userId: member.userId,
                                newRole: event.target.value as StoreRole,
                              })
                            }
                            className="h-8 w-auto min-w-[7.5rem] py-1 text-xs"
                            aria-label={`Role for ${member.firstName}`}
                            disabled={roleMutation.isPending}
                          >
                            {(['admin', 'manager', 'cashier', 'viewer'] as StoreRole[]).map(
                              (item) => (
                                <option key={item} value={item}>
                                  {ROLE_LABELS[item]}
                                </option>
                              ),
                            )}
                          </Select>
                        ) : (
                          <span title={ROLE_DESCRIPTIONS[member.role]}>
                            <Badge
                              tone={
                                member.role === 'admin'
                                  ? 'purple'
                                  : member.role === 'manager'
                                    ? 'brand'
                                    : 'neutral'
                              }
                            >
                              {ROLE_LABELS[member.role]}
                            </Badge>
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-500 dark:text-ink-400">
                        {formatDate(member.assignedAt, timezone)}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-500 dark:text-ink-400">
                        {member.lastLoginAt ? relativeTime(member.lastLoginAt) : 'Never'}
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          {canManage && !member.isOwner && !isSelf ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-500"
                              title="Remove member"
                              aria-label={`Remove ${member.firstName} ${member.lastName}`}
                              onClick={() => setRemoveTarget(member)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-[10px] text-ink-400">—</span>
                          )}
                        </div>
                      </Td>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
          )
        ) : null}

        {tab === 'invitations' ? (
          invitationsQuery.isLoading ? (
            <SkeletonTable rows={4} columns={5} />
          ) : invitationsQuery.isError ? (
            <ErrorState
              message={getErrorMessage(invitationsQuery.error)}
              onRetry={() => void invitationsQuery.refetch()}
            />
          ) : invitations.length === 0 ? (
            <EmptyState
              title="No invitations"
              description="Invited teammates appear here until they accept or the invitation expires."
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setInviteOpen(true)}>
                    Invite member
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Expires</Th>
                  <Th className="text-right">Created</Th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <Td className="text-xs font-medium">{invitation.email}</Td>
                    <Td>
                      <Badge tone="brand">{ROLE_LABELS[invitation.role]}</Badge>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          invitation.status === 'pending'
                            ? 'warning'
                            : invitation.status === 'accepted'
                              ? 'success'
                              : 'neutral'
                        }
                      >
                        {titleCase(invitation.status)}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-ink-500 dark:text-ink-400">
                      {formatDate(invitation.expiresAt, timezone)}
                    </Td>
                    <Td className="whitespace-nowrap text-right text-xs text-ink-500 dark:text-ink-400">
                      {formatDate(invitation.createdAt, timezone)}
                    </Td>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )
        ) : null}

        {tab === 'activity' && canSeeActivity ? (
          activityQuery.isLoading ? (
            <SkeletonTable rows={7} columns={4} />
          ) : activityQuery.isError ? (
            <ErrorState
              message={getErrorMessage(activityQuery.error)}
              onRetry={() => void activityQuery.refetch()}
            />
          ) : activityQuery.data && activityQuery.data.data.length === 0 ? (
            <EmptyState title="No activity yet" description="Team actions will be logged here." />
          ) : (
            <>
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {activityQuery.data?.data.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                      <Activity className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink-800 dark:text-ink-100">
                        {activityLabel(entry.action)}
                        <span className="ml-1.5 font-normal text-ink-400">
                          {entry.entityType ? `· ${entry.entityType}` : ''}
                        </span>
                      </p>
                      <p className="text-[10px] text-ink-500 dark:text-ink-400">
                        {entry.userName ?? entry.userEmail ?? 'System'} ·{' '}
                        {formatDateTime(entry.createdAt, timezone)}
                      </p>
                      {entry.details ? (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-ink-400">
                          {JSON.stringify(entry.details)}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[10px] text-ink-400">
                      {relativeTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
              <Pagination meta={activityQuery.data?.meta} onPageChange={setActivityPage} />
            </>
          )
        ) : null}
      </DataCard>

      <Card>
        <CardContent className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
          Roles are enforced server-side on every request. Store membership role is authoritative —
          even a business owner invited as a viewer only gets viewer permissions in that store.
        </CardContent>
      </Card>

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget)}
        title={`Remove ${removeTarget?.firstName ?? 'member'}?`}
        description="They will lose access to this store immediately. Historical activity stays intact."
        confirmLabel="Remove member"
        destructive
        loading={removeMutation.isPending}
      />
    </div>
  );
}
