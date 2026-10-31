import Link from 'next/link';
import CommitteeSection from '@/components/committee-section';
import PortalShell from '@/components/portal-shell';

export default function AssociationPage() {
  return (
    <PortalShell title="An association for every generation" eyebrow="ABOUT THE SFS ALUMNI ASSOCIATION">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-2xl bg-white border border-outline-variant p-7 md:p-9">
          <h2 className="text-headline-md text-primary">Our purpose</h2>
          <p className="text-body-md text-on-surface-variant mt-4 leading-relaxed">
            The SFS Alumni Association brings together former students of St. Francis de Sales High
            School, Shanti Nagar, Secunderabad. It exists to preserve shared memories, strengthen
            lifelong friendships, support current students and contribute to the school’s future.
          </p>
          <p className="text-body-sm text-on-surface-variant mt-4">
            This is proposed copy. The alumni committee should approve the final mission statement,
            constitution, membership rules and contact details before publication.
          </p>
          <Link
            href="/member"
            className="inline-flex mt-6 rounded-lg bg-primary text-white px-5 py-3"
          >
            Visit member portal ↗
          </Link>
        </section>
        <section className="rounded-2xl bg-primary text-white p-7 md:p-9">
          <div className="text-label-sm uppercase tracking-widest text-secondary-fixed">1976–2026</div>
          <h2 className="text-headline-md mt-3">50 years of SFS</h2>
          <p className="text-body-sm text-white/80 mt-3">
            A school legacy carried forward by students, teachers, families and alumni across
            generations.
          </p>
        </section>
      </div>
      <CommitteeSection />
    </PortalShell>
  );
}
