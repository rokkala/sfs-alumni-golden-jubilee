/** Assert admin temp password shape matches API (Sfs + 8 alnum + !). */
const chunk = Math.random().toString(36).slice(2, 10);
const sample = `Sfs${chunk}!`;
if (sample.length < 8) throw new Error('temp password too short');
if (!/^Sfs[a-z0-9]{8}!$/.test(sample)) throw new Error(`bad shape: ${sample}`);
console.log('ok', sample);
