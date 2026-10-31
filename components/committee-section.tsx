'use client';

import { useEffect, useState } from 'react';
import type { PublicCommitteeMember } from '@/components/association-modal';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Compact committee list for the About page (not marketing cards). */
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
      <p className="text-body-sm text-on-surface-variant mt-2 mb-4">
        Current association officers — reach out when you need help with membership or events.
      </p>
      <ul className="rounded-2xl border border-outline-variant bg-white divide-y divide-outline-variant">
        {members.map((m) => (
          <li key={m.id} className="p-4 flex gap-3 items-start">
            {m.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.photo_url}
                alt=""
                className="w-12 h-12 rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary text-label-sm font-bold grid place-items-center shrink-0">
                {initials(m.full_name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-label-sm uppercase tracking-wider text-jubilee-gold-deep font-bold">
                {m.role}
              </p>
              <p className="text-body-md text-primary font-semibold">{m.full_name}</p>
              {m.bio ? (
                <p className="text-body-sm text-on-surface-variant mt-1 leading-snug">{m.bio}</p>
              ) : null}
              <p className="text-body-sm text-on-surface-variant mt-1">Batch {m.batch}</p>
              <a
                href={`mailto:${m.email}`}
                className="text-body-sm text-primary hover:underline break-all"
              >
                {m.email}
              </a>
              {m.phone_number ? (
                <a
                  href={`tel:${m.phone_number}`}
                  className="block text-body-sm text-on-surface-variant hover:text-primary"
                >
                  {m.phone_number}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
