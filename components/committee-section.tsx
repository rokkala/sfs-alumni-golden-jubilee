'use client';

import { useEffect, useState } from 'react';

export type PublicCommitteeMember = {
  id: string;
  full_name: string;
  role: string;
  email: string;
  batch: number;
  phone_number: string | null;
  photo_url: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CommitteeSection({
  variant = 'landing',
}: {
  variant?: 'landing' | 'about';
}) {
  const [members, setMembers] = useState<PublicCommitteeMember[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/committee', { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setMembers([]);
          return;
        }
        setMembers(Array.isArray(payload.members) ? payload.members : []);
      } catch {
        if (active) setMembers([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (members === null) {
    return (
      <section className={sectionClass(variant)} id="committee">
        <div className={innerClass(variant)}>
          <Header variant={variant} />
          <p className="text-body-sm text-on-surface-variant">Loading committee…</p>
        </div>
      </section>
    );
  }

  if (!members.length) return null;

  return (
    <section className={sectionClass(variant)} id="committee">
      <div className={innerClass(variant)}>
        <Header variant={variant} />
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {members.map((m) => (
            <li
              key={m.id}
              className="rounded-2xl border border-outline-variant bg-surface-paper overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-primary/5 relative">
                {m.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photo_url}
                    alt={m.full_name}
                    className="absolute inset-0 w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-primary text-headline-lg font-bold tracking-wide">
                    {initials(m.full_name)}
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col gap-1.5 flex-1">
                <p className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep font-bold">
                  {m.role}
                </p>
                <h3 className="text-headline-sm text-primary">{m.full_name}</h3>
                <p className="text-body-sm text-on-surface-variant">Batch {m.batch}</p>
                <a
                  href={`mailto:${m.email}`}
                  className="text-body-sm text-primary hover:underline underline-offset-2 break-all mt-2"
                >
                  {m.email}
                </a>
                {m.phone_number ? (
                  <a
                    href={`tel:${m.phone_number}`}
                    className="text-body-sm text-on-surface-variant hover:text-primary"
                  >
                    {m.phone_number}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Header({ variant }: { variant: 'landing' | 'about' }) {
  if (variant === 'about') {
    return (
      <>
        <h2 className="text-headline-md text-primary">Alumni Committee</h2>
        <p className="text-body-sm text-on-surface-variant mt-2">
          Current association officers — reach out when you need help with membership or events.
        </p>
      </>
    );
  }
  return (
    <div className="text-center max-w-2xl mx-auto">
      <span className="text-label-sm uppercase tracking-widest text-jubilee-gold-deep font-bold">
        Association
      </span>
      <h2 className="text-headline-lg text-primary tracking-tight mt-1">Alumni Committee</h2>
      <p className="text-body-sm text-on-surface-variant mt-2">
        Look up who to contact for membership, events, and association matters.
      </p>
    </div>
  );
}

function sectionClass(variant: 'landing' | 'about') {
  return variant === 'landing'
    ? 'w-full bg-surface-ivory py-16 lg:py-20'
    : 'w-full';
}

function innerClass(variant: 'landing' | 'about') {
  return variant === 'landing' ? 'max-w-7xl mx-auto px-6 lg:px-12' : '';
}
