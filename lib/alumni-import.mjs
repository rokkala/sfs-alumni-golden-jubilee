import { inflateRawSync } from 'node:zlib';

// ponytail: copies the batch, section, and Indian-phone rules used by signup.
// Upgrade path: import lib/registration-fields.ts and lib/phone.ts once Node loads this repo's .ts as ESM.

const BATCH_START_YEAR = 1986;
const SECTIONS = new Set(['A', 'B', 'C', 'D']);
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_FIX = {
  'gamil.com': 'gmail.com',
  'gmail.coml': 'gmail.com',
  'gmail.cim': 'gmail.com',
  '2009gmail.com': 'gmail.com',
  'yahoomail.com': 'yahoo.com',
};

function cleanName(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Turn a sheet email into a lowercase address, or null when it still is not an address. */
export function repairEmail(raw) {
  const compact = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const at = compact.lastIndexOf('@');
  if (at <= 0 || at === compact.length - 1) return null;

  const local = compact.slice(0, at).replace(/^[,.]+|[,.]+$/g, '');
  let domain = compact
    .slice(at + 1)
    .replace(/,/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '');
  if (DOMAIN_FIX[domain]) domain = DOMAIN_FIX[domain];
  if (!domain.includes('.')) {
    if (domain.endsWith('com')) domain = `${domain.slice(0, -3)}.com`;
    else if (domain.endsWith('coin')) domain = `${domain.slice(0, -4)}.co.in`;
  }
  if (!local || !domain) return null;

  const email = `${local}@${domain}`;
  return EMAIL_SHAPE.test(email) ? email : null;
}

/** Indian mobiles without a country code become +91. Anything still invalid is dropped. */
export function repairPhone(raw) {
  if (raw == null || raw === '') return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (text.startsWith('+')) {
    const digits = digitsOnly(text);
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digits = digitsOnly(text);
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return `+${digits}`;
  }
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function expandShortYear(end, start) {
  const value = Number(end);
  if (String(end).length === 4) return value;
  if (start != null && String(start).length === 4) {
    const base = Number(start);
    const year = Math.floor(base / 100) * 100 + value;
    return year >= base ? year : year + 100;
  }
  return value >= 85 ? 1900 + value : 2000 + value;
}

function acceptableYear(year) {
  const through = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= BATCH_START_YEAR && year <= through;
}

function cleanBatch(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isInteger(raw)) return acceptableYear(raw) ? raw : null;

  const text = String(raw).trim();
  if (!text) return null;
  const longRange = text.match(/\b((?:19|20)\d{2})\s*-\s*(\d{2,4})\b/);
  if (longRange) {
    const year = expandShortYear(longRange[2], longRange[1]);
    return acceptableYear(year) ? year : null;
  }
  const shortRange = text.match(/\b(\d{2})\s*-\s*(\d{2})\b/);
  if (shortRange) {
    const year = expandShortYear(shortRange[2], shortRange[1]);
    return acceptableYear(year) ? year : null;
  }
  const four = [...text.matchAll(/\b((?:19|20)\d{2})\b/g)].map((match) => Number(match[1]));
  if (four.length) {
    const year = four[four.length - 1];
    return acceptableYear(year) ? year : null;
  }
  const two = text.match(/\b(\d{2})\b/);
  if (two) {
    const year = expandShortYear(two[1]);
    return acceptableYear(year) ? year : null;
  }
  return null;
}

function cleanSection(raw) {
  const value = String(raw ?? '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim();
  if (!value || /^(n\/?a|none|null|nil|-)$/i.test(value)) return null;
  const direct = value.toUpperCase();
  if (SECTIONS.has(direct)) return direct;
  const labeled =
    value.match(/section\s*[-:]?\s*([ABCD])\b/i) || value.match(/\b([ABCD])\s*[-]?\s*section\b/i);
  if (labeled) return labeled[1].toUpperCase();
  const compact = value.match(/^(?:\d+(?:st|nd|rd|th)?)?\s*([ABCD])$/i);
  if (compact) return compact[1].toUpperCase();
  return null;
}

function cleanLocation(raw) {
  const value = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return value || null;
}

function joinName(firstName, lastName) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

function nextPlaceholderEmail(used) {
  let number = 123;
  let email = `${number}@gmail.com`;
  while (used.has(email)) {
    number += 1;
    email = `${number}@gmail.com`;
  }
  return email;
}

function placeholderKey(name, phone) {
  return `${String(name || '').trim().toLowerCase()}|${phone || ''}`;
}

export function planAlumniImport(rows, existingEmails, existingUsernames = {}, savedPlaceholders = []) {
  const existing = new Set(
    existingEmails.map((email) => repairEmail(email) || String(email).trim().toLowerCase())
  );
  const usernames = new Map(
    Object.entries(existingUsernames).map(([email, username]) => [
      repairEmail(email) || String(email).trim().toLowerCase(),
      String(username || '').trim().toLowerCase(),
    ])
  );
  const savedByKey = new Map();
  for (const person of savedPlaceholders) {
    const phone = repairPhone(person.phone) || '';
    const key = placeholderKey(person.name, phone);
    const list = savedByKey.get(key) || [];
    list.push(person);
    savedByKey.set(key, list);
  }
  function findSaved(name, rawPhone) {
    const phone = repairPhone(rawPhone) || '';
    const matches = phone
      ? savedByKey.get(placeholderKey(name, phone)) || []
      : [...savedByKey.values()]
          .flat()
          .filter(
            (person) =>
              person.name.trim().toLowerCase() === name.trim().toLowerCase() && !repairPhone(person.phone)
          );
    if (!matches.length) return null;
    return matches
      .slice()
      .sort((left, right) =>
        String(left.email).localeCompare(String(right.email), undefined, { numeric: true })
      )[0];
  }
  const seen = new Set();
  const seenUsername = new Map();
  const accounts = [];
  const skipped = [];
  const lines = [];

  for (const row of rows) {
    const firstName = cleanName(row.firstName);
    const lastName = cleanName(row.lastName);
    const name = [firstName, lastName].filter(Boolean).join(' ');
    let email = repairEmail(row.email);
    if (!email) {
      if (!firstName) {
        skipped.push({ reason: 'no-name', email: '', name: name || 'Unknown' });
        lines.push({ name: name || 'Unknown', email: '', username: '', status: 'skipped' });
        continue;
      }
      const savedPerson = findSaved(name, row.phone);
      if (savedPerson) {
        const savedEmail = repairEmail(savedPerson.email) || savedPerson.email;
        const username = savedPerson.username || usernames.get(savedEmail) || savedEmail;
        skipped.push({ reason: 'existing', email: savedEmail, name });
        lines.push({ name, email: savedEmail, username, status: 'existing' });
        continue;
      }
      email = nextPlaceholderEmail(new Set([...existing, ...seen]));
      const created = { name, phone: repairPhone(row.phone) || '', email, username: email };
      const key = placeholderKey(name, created.phone);
      savedByKey.set(key, [...(savedByKey.get(key) || []), created]);
    }
    if (existing.has(email)) {
      const username = usernames.get(email) || email;
      skipped.push({ reason: 'existing', email, name });
      lines.push({ name, email, username, status: 'existing' });
      continue;
    }
    if (seen.has(email)) {
      skipped.push({ reason: 'duplicate-email', email, name });
      lines.push({
        name,
        email,
        username: seenUsername.get(email) || email,
        status: 'duplicate',
      });
      continue;
    }
    if (!firstName) {
      skipped.push({ reason: 'no-name', email, name: email });
      lines.push({ name: email, email, username: '', status: 'skipped' });
      continue;
    }

    seen.add(email);
    seenUsername.set(email, email);
    accounts.push({
      email,
      username: email,
      firstName,
      lastName,
      fullName: joinName(firstName, lastName),
      phone: repairPhone(row.phone),
      batch: cleanBatch(row.year),
      section: cleanSection(row.section),
      location: cleanLocation(row.location),
    });
    lines.push({ name, email, username: email, status: 'create' });
  }

  return { accounts, skipped, lines };
}

export function toAccountRow(account, passwordHash) {
  return {
    email: account.email,
    password_hash: passwordHash,
    full_name: account.fullName,
    phone_number: account.phone,
    role: 'alumni',
    member_status: 'verified',
    batch: account.batch,
    section: account.section,
    current_location: account.location,
    bio:
      'sfs1:' +
      JSON.stringify({
        section: account.section || '',
        lastName: account.lastName || '',
        firstName: account.firstName,
        username: account.username,
      }),
    first_name: account.firstName,
    last_name: account.lastName,
    username: account.username,
  };
}

function decodeXml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

function unzip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Choose an .xlsx workbook');
  const count = buf.readUInt16LE(eocd + 10);
  let cursor = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let index = 0; index < count; index += 1) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Choose an .xlsx workbook');
    const method = buf.readUInt16LE(cursor + 10);
    const size = buf.readUInt32LE(cursor + 20);
    const nameLength = buf.readUInt16LE(cursor + 28);
    const extraLength = buf.readUInt16LE(cursor + 30);
    const commentLength = buf.readUInt16LE(cursor + 32);
    const localOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buf.subarray(start, start + size);
    files.set(name, method === 0 ? compressed : inflateRawSync(compressed));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function sharedStrings(xml) {
  const strings = [];
  for (const item of xml.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) || []) {
    const parts = [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]));
    strings.push(parts.join(''));
  }
  return strings;
}

function sheetCells(xml, strings) {
  const rows = [];
  for (const row of xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || []) {
    const cells = {};
    for (const match of row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)\d+"/.exec(match[1]);
      if (!ref) continue;
      const type = /t="([^"]+)"/.exec(match[1])?.[1] || '';
      const body = match[2] || '';
      if (type === 'inlineStr') {
        const text = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(body);
        cells[ref[1]] = text ? decodeXml(text[1]) : '';
        continue;
      }
      const value = /<v>([\s\S]*?)<\/v>/.exec(body);
      if (!value) {
        cells[ref[1]] = '';
        continue;
      }
      cells[ref[1]] = type === 's' ? strings[Number(value[1])] || '' : decodeXml(value[1]);
    }
    rows.push(cells);
  }
  return rows;
}

/** Read the alumni workbook columns. Throws when the header is not the alumni sheet. */
export function readAlumniSheet(buffer) {
  const files = unzip(buffer);
  const sheetName = [...files.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const sharedName = [...files.keys()].find((name) => name.endsWith('sharedStrings.xml'));
  if (!sheetName) throw new Error('Choose an .xlsx workbook');
  const strings = sharedName ? sharedStrings(files.get(sharedName).toString('utf8')) : [];
  const rows = sheetCells(files.get(sheetName).toString('utf8'), strings);
  const header = rows.find((row) => Object.values(row).some((value) => /email/i.test(String(value))));
  if (!header || !/email/i.test(String(header.H || '')) || !/name/i.test(String(header.B || ''))) {
    throw new Error('This workbook is not the alumni sheet');
  }
  const headerIndex = rows.indexOf(header);
  return rows.slice(headerIndex + 1).flatMap((row) => {
    const record = {
      firstName: row.B || '',
      lastName: row.C || '',
      year: row.D || '',
      section: row.E || '',
      location: row.F || '',
      phone: row.G || '',
      email: row.H || '',
    };
    const blank = Object.values(record).every((value) => String(value).trim() === '');
    return blank ? [] : [record];
  });
}
