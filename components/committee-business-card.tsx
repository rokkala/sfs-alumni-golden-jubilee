export type PublicCommitteeMember = {
  id: string;
  full_name: string;
  role: string;
  email: string;
  batch: number;
  phone_number: string | null;
  bio: string | null;
  photo_url: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Contact card for a published committee member (mailto / tel are the interactions). */
export default function CommitteeBusinessCard({
  member,
  compact = false,
}: {
  member: PublicCommitteeMember;
  compact?: boolean;
}) {
  const photoSize = compact ? 'h-16 w-16' : 'h-20 w-20';

  return (
    <article className="relative flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-white shadow-[0_1px_0_rgba(26,45,74,0.04)]">
      <div
        className="h-1.5 w-full bg-gradient-to-r from-jubilee-gold-deep via-jubilee-amber to-jubilee-gold-light"
        aria-hidden
      />
      <div className={`flex flex-1 flex-col ${compact ? 'p-4' : 'p-5'} gap-3`}>
        <div className="flex gap-3 items-start">
          {member.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.photo_url}
              alt=""
              className={`${photoSize} rounded-lg object-cover shrink-0 bg-primary/5`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className={`${photoSize} rounded-lg bg-primary/10 text-primary text-label-md font-bold grid place-items-center shrink-0`}
              aria-hidden
            >
              {initials(member.full_name)}
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-label-sm uppercase tracking-wider text-jubilee-gold-deep font-bold leading-snug">
              {member.role}
            </p>
            <h3 className="text-body-md text-primary font-semibold leading-snug mt-0.5">
              {member.full_name}
            </h3>
            <p className="text-body-sm text-on-surface-variant mt-1">Batch {member.batch}</p>
          </div>
        </div>

        {member.bio ? (
          <p className="text-body-sm text-on-surface-variant leading-snug line-clamp-3">
            {member.bio}
          </p>
        ) : null}

        <div className="mt-auto pt-2 border-t border-outline-variant/70 space-y-1">
          <a
            href={`mailto:${member.email}`}
            className="flex items-center gap-2 text-body-sm text-primary hover:underline underline-offset-2 break-all focus:outline-none focus:ring-2 focus:ring-primary/30 rounded"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden>
              mail
            </span>
            {member.email}
          </a>
          {member.phone_number ? (
            <a
              href={`tel:${member.phone_number}`}
              className="flex items-center gap-2 text-body-sm text-on-surface-variant hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 rounded"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden>
                call
              </span>
              {member.phone_number}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
