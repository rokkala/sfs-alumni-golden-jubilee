'use client';

import { useEffect, useState } from 'react';
import CommitteeBusinessCard, {
  type PublicCommitteeMember,
} from '@/components/committee-business-card';

/** Alumni committee as business cards on the About page. */
export default function CommitteeSection() {
  const [members, setMembers] = useState<PublicCommitteeMember[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/committee', { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        setMembers(res.ok && Array.isArray(payload.members) ? payload.members : []);
      } catch {
        if (active) setMembers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (members === null) {
    return <p className="text-body-sm text-on-surface-variant mt-6">Loading committee…</p>;
  }
  if (!members.length) return null;

  return (
    <div className="mt-8">
      <h2 className="text-headline-md text-primary">Alumni Committee</h2>
      <p className="text-body-sm text-on-surface-variant mt-2 mb-5">
        Current association officers — reach out when you need help with membership or events.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 list-none p-0 m-0">
        {members.map((m) => (
          <li key={m.id} className="min-w-0">
            <CommitteeBusinessCard member={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}
