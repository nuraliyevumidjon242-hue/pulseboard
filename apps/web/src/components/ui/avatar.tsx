import { cn, initials } from '../../lib/utils';

const PALETTE = [
  'from-brand-500 to-violet-500',
  'from-cyan-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 997;
  }
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}

export function Avatar({
  firstName,
  lastName,
  src,
  size = 'md',
  className,
  ring = false,
}: {
  firstName?: string | null;
  lastName?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  ring?: boolean;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[9px]',
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
  };
  const label = initials(firstName, lastName);

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName ?? ''} ${lastName ?? ''}`.trim() || 'User avatar'}
        className={cn(
          'shrink-0 rounded-full object-cover',
          sizes[size],
          ring && 'ring-2 ring-white dark:ring-ink-900',
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-bold text-white',
        colorFor(`${firstName ?? ''}${lastName ?? ''}`),
        sizes[size],
        ring && 'ring-2 ring-white dark:ring-ink-900',
        className,
      )}
    >
      {label}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
}: {
  people: Array<{ firstName?: string | null; lastName?: string | null; avatarUrl?: string | null }>;
  max?: number;
}) {
  const visible = people.slice(0, max);
  const remaining = people.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((person, index) => (
        <Avatar
          key={`${person.firstName}-${index}`}
          firstName={person.firstName}
          lastName={person.lastName}
          src={person.avatarUrl}
          size="sm"
          ring
        />
      ))}
      {remaining > 0 ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-[10px] font-bold text-ink-600 ring-2 ring-white dark:bg-ink-700 dark:text-ink-200 dark:ring-ink-900">
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}
