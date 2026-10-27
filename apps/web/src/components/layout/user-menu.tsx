import { LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../../lib/permissions';
import { useAuthStore, useActiveStore } from '../../stores/auth-store';
import { toast } from '../../stores/toast-store';
import { Avatar } from '../ui/avatar';
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel } from '../ui/dropdown';

export function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const store = useActiveStore();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <Dropdown
      label="Account menu"
      panelClassName="w-64"
      trigger={
        <span className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-ink-100 dark:hover:bg-ink-800">
          <Avatar
            firstName={user.firstName}
            lastName={user.lastName}
            src={user.avatarUrl}
            size="sm"
          />
          <span className="hidden min-w-0 text-left md:block">
            <span className="block max-w-[9rem] truncate text-xs font-semibold text-ink-900 dark:text-white">
              {user.firstName} {user.lastName}
            </span>
            <span className="block text-[10px] font-medium text-ink-500 dark:text-ink-400">
              {store ? ROLE_LABELS[store.role] : user.email}
            </span>
          </span>
        </span>
      }
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar
              firstName={user.firstName}
              lastName={user.lastName}
              src={user.avatarUrl}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">{user.email}</p>
            </div>
          </div>
          <DropdownDivider />
          <DropdownLabel>Account</DropdownLabel>
          <DropdownItem
            icon={<UserRound className="h-4 w-4" />}
            onClick={() => {
              close();
              navigate('/settings?tab=profile');
            }}
          >
            My profile
          </DropdownItem>
          <DropdownItem
            icon={<Settings className="h-4 w-4" />}
            onClick={() => {
              close();
              navigate('/settings');
            }}
          >
            Workspace settings
          </DropdownItem>
          {store ? (
            <DropdownItem
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => {
                close();
                navigate('/settings?tab=security');
              }}
            >
              Security
            </DropdownItem>
          ) : null}
          <DropdownDivider />
          <DropdownItem
            danger
            icon={<LogOut className="h-4 w-4" />}
            onClick={async () => {
              close();
              await logout();
              toast.success('Signed out', 'See you again soon.');
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
