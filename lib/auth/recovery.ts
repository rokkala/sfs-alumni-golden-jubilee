export type RecoveryQuestion = { id: string; label: string };

/** Fixed bank — members pick exactly two. */
export const RECOVERY_QUESTIONS: readonly RecoveryQuestion[] = [
  { id: 'mother_maiden', label: "Mother's maiden name" },
  { id: 'father_middle', label: "Father's middle name" },
  { id: 'first_school', label: 'Name of first school' },
  { id: 'childhood_nickname', label: 'Childhood nickname' },
  { id: 'favourite_teacher', label: 'Favourite teacher at SFS' },
  { id: 'best_friend', label: "Best friend's name growing up" },
  { id: 'birth_city', label: 'City/town you were born in' },
  { id: 'grew_up_street', label: 'Street you grew up on' },
  { id: 'first_pet', label: "First pet's name" },
  { id: 'favourite_subject', label: 'Favourite subject at school' },
  { id: 'house_hostel', label: 'Name of your house/hostel (if any)' },
  { id: 'joined_sfs_year', label: 'Year you joined SFS' },
] as const;

const QUESTION_IDS = new Set(RECOVERY_QUESTIONS.map((q) => q.id));

export function recoveryQuestionLabel(id: string): string | null {
  return RECOVERY_QUESTIONS.find((q) => q.id === id)?.label ?? null;
}

/** Lowercase, trim, collapse internal whitespace. */
export function normalizeRecoveryAnswer(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function phoneLast4Digits(storedPhone: string | null | undefined): string | null {
  const digits = String(storedPhone || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function phoneLast4Matches(
  inputLast4: string,
  storedPhone: string | null | undefined
): boolean {
  const want = String(inputLast4 || '').replace(/\D/g, '');
  if (want.length !== 4) return false;
  const have = phoneLast4Digits(storedPhone);
  if (!have) return false;
  return want === have;
}

/** When account has no batch, any input is fine. When it has one, must match. */
export function batchMatches(
  accountBatch: number | null | undefined,
  input: string | number | null | undefined
): boolean {
  if (accountBatch == null || Number.isNaN(Number(accountBatch))) return true;
  const raw = String(input ?? '').trim();
  if (!raw) return false;
  return Number(raw) === Number(accountBatch);
}

/** Null when the pick is valid (exactly two distinct known ids). */
export function validateQuestionPick(ids: string[]): string | null {
  if (!Array.isArray(ids) || ids.length !== 2) {
    return 'Choose exactly two recovery questions';
  }
  if (ids[0] === ids[1]) return 'Pick two different questions';
  for (const id of ids) {
    if (!QUESTION_IDS.has(id)) return 'Unknown recovery question';
  }
  return null;
}

export type RecoveryColumns = {
  recovery_q1: string | null;
  recovery_a1_hash: string | null;
  recovery_q2: string | null;
  recovery_a2_hash: string | null;
};

export function recoveryConfigured(row: RecoveryColumns): boolean {
  return Boolean(
    row.recovery_q1 && row.recovery_a1_hash && row.recovery_q2 && row.recovery_a2_hash
  );
}
