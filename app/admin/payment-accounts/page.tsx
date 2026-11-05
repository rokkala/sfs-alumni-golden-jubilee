'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin-shell';

type Account = {
  id: string;
  label: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  bank_name: string | null;
  upi_id: string | null;
  active: boolean;
  sort_order: number;
};

type Proof = {
  id: string;
  source_type: string;
  registration_id: string | null;
  donation_id: string | null;
  amount_paise: number;
  utr: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  screenshot_url: string | null;
  donor_name: string;
  donor_email: string;
  payment_account_label: string | null;
};

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

const emptyForm = {
  label: '',
  account_name: '',
  account_number: '',
  ifsc: '',
  bank_name: '',
  upi_id: '',
  sort_order: '0',
  active: false,
};

export default function AdminPaymentAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    const res = await fetch('/api/admin/payment-accounts', { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Could not load accounts');
    setAccounts(payload.accounts || []);
  }, []);

  const loadProofs = useCallback(async () => {
    const res = await fetch('/api/admin/offline-proofs?status=pending', { cache: 'no-store' });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Could not load proofs');
    setProofs(payload.proofs || []);
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      await Promise.all([loadAccounts(), loadProofs()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    }
  }, [loadAccounts, loadProofs]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(a: Account) {
    setEditingId(a.id);
    setForm({
      label: a.label,
      account_name: a.account_name,
      account_number: a.account_number,
      ifsc: a.ifsc,
      bank_name: a.bank_name || '',
      upi_id: a.upi_id || '',
      sort_order: String(a.sort_order),
      active: a.active,
    });
    setOk('');
    setError('');
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const body = {
        label: form.label,
        accountName: form.account_name,
        accountNumber: form.account_number,
        ifsc: form.ifsc,
        bankName: form.bank_name,
        upiId: form.upi_id,
        sortOrder: Number(form.sort_order) || 0,
        active: form.active,
      };
      const url = editingId
        ? `/api/admin/payment-accounts/${editingId}`
        : '/api/admin/payment-accounts';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Save failed');
        return;
      }
      setOk(editingId ? 'Account updated.' : 'Account added.');
      startCreate();
      await loadAccounts();
    } catch {
      setError('Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(id: string) {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res = await fetch(`/api/admin/payment-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: true }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not activate');
        return;
      }
      setOk('Active account updated. Members will see these details.');
      await loadAccounts();
    } catch {
      setError('Could not activate');
    } finally {
      setBusy(false);
    }
  }

  async function decideProof(id: string, status: 'approved' | 'rejected') {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const res = await fetch(`/api/admin/offline-proofs/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not update proof');
        return;
      }
      setOk(status === 'approved' ? 'Proof approved — payment marked paid.' : 'Proof rejected.');
      await loadProofs();
    } catch {
      setError('Could not update proof');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Bank / UPI">
      <p className="text-body-sm text-on-surface-variant mb-6 max-w-3xl">
        Manage bank transfer and UPI details shown when members choose offline payment. Only{' '}
        <strong>one account can be active</strong> at a time. Review UTR / screenshot submissions
        below.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <section className="rounded-2xl border border-outline-variant bg-white p-5 space-y-4 h-fit">
          <div>
            <h3 className="text-headline-sm text-primary">Payment accounts</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              IFSC + account number for NEFT/IMPS, and optional UPI ID for QR scan.
            </p>
          </div>

          <form onSubmit={onSave} className="space-y-3">
            <h4 className="text-label-md text-primary uppercase tracking-wider">
              {editingId ? 'Edit account' : 'Add account'}
            </h4>
            {(
              [
                ['label', 'Label', 'e.g. Jubilee event fees'],
                ['account_name', 'Account holder name', ''],
                ['account_number', 'Account number', ''],
                ['ifsc', 'IFSC', 'SBIN0001234'],
                ['bank_name', 'Bank name (optional)', ''],
                ['upi_id', 'UPI ID (optional)', 'name@oksbi'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="text-label-sm uppercase tracking-wider text-primary">{label}</span>
                <input
                  required={key !== 'bank_name' && key !== 'upi_id'}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  disabled={busy}
                  placeholder={placeholder}
                  className="mt-1 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            ))}
            <label className="block">
              <span className="text-label-sm uppercase tracking-wider text-primary">
                Display order
              </span>
              <input
                inputMode="numeric"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                disabled={busy}
                className="mt-1 w-full px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="flex items-center gap-2 text-body-sm text-primary font-medium">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                disabled={busy}
              />
              Set as the active account (deactivates others)
            </label>
            {error ? (
              <p className="rounded-lg bg-error-container text-error text-body-sm p-3">{error}</p>
            ) : null}
            {ok ? (
              <p className="rounded-lg bg-secondary-container text-on-secondary-fixed text-body-sm p-3">
                {ok}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-primary text-on-primary px-4 py-2.5 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {busy ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={startCreate}
                  disabled={busy}
                  className="rounded-lg border border-outline-variant px-4 py-2.5 text-label-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <ul className="divide-y divide-outline-variant border-t border-outline-variant pt-3">
            {accounts.length === 0 ? (
              <li className="py-3 text-body-sm text-on-surface-variant">No accounts yet.</li>
            ) : (
              accounts.map((a) => (
                <li key={a.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-body-sm font-medium text-primary">
                      {a.label}{' '}
                      {a.active ? (
                        <span className="text-label-sm uppercase tracking-wider text-green-700">
                          Active
                        </span>
                      ) : null}
                    </p>
                    <p className="text-body-sm text-on-surface-variant">
                      {a.account_name} · {a.account_number} · {a.ifsc}
                      {a.upi_id ? ` · ${a.upi_id}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!a.active ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setActive(a.id)}
                        className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        Set active
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(a)}
                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-sm font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-white p-5 space-y-4 h-fit">
          <div>
            <h3 className="text-headline-sm text-primary">Pending proofs</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Approve to mark the registration or donation paid. Reject leaves payment unpaid.
            </p>
          </div>
          <ul className="space-y-4">
            {proofs.length === 0 ? (
              <li className="text-body-sm text-on-surface-variant">No pending submissions.</li>
            ) : (
              proofs.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-outline-variant p-4 space-y-2"
                >
                  <p className="text-body-sm font-medium text-primary">
                    {p.donor_name} · {formatInr(p.amount_paise)}
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    {p.donor_email} · {p.source_type}
                    {p.payment_account_label ? ` · ${p.payment_account_label}` : ''}
                  </p>
                  {p.utr ? (
                    <p className="text-body-sm text-on-surface">
                      UTR: <span className="tabular-nums">{p.utr}</span>
                    </p>
                  ) : null}
                  {p.screenshot_url ? (
                    <a
                      href={p.screenshot_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-label-sm font-bold uppercase tracking-wider text-primary underline focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      View screenshot
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decideProof(p.id, 'approved')}
                      className="rounded-lg bg-primary text-on-primary px-3 py-1.5 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decideProof(p.id, 'rejected')}
                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-label-sm font-bold uppercase tracking-wider disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
