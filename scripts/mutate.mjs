/**
 * §4.1c for the beginner front-section: one source patch per rendered verdict,
 * each required to turn a NAMED test red.
 *
 * Run: node scripts/mutate.mjs
 *
 * A green-then-red pair proves nothing on its own, so every case asserts four
 * things before it counts the failure: the UNMUTATED baseline passes, the patch
 * anchor is unique and the file actually changed, the BUILT BUNDLE HASH MOVED,
 * and the named owning test is the one that failed. Source and bundle are
 * restored afterwards and the restore hash compared. Evidence is written by
 * this runner, from the runs it actually performed.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const observations = [];

const cases = [
  {
    id: 'M1',
    file: 'src/first-look.ts',
    anchor: '  return decodeTextPacket(extractBitsSpatial(image, bitCount));',
    replace: '  return SECRET;',
    test: 'step 3 control: the same read of the untouched original returns nothing',
    why: 'an extract that returns the message without reading the image',
  },
  {
    id: 'M2',
    file: 'src/first-look.ts',
    anchor: '  return { flagged: res.pEmbed > DETECT_THRESHOLD, pEmbed: res.pEmbed, chi2: res.chi2 };',
    replace: '  return { flagged: true, pEmbed: res.pEmbed, chi2: res.chi2 };',
    test: 'step 4: the detector reports nothing found on both pictures',
    why: 'a detector hard-wired to report a finding',
  },
  {
    id: 'M3',
    file: 'src/first-look.ts',
    anchor: '  return { flagged: res.pEmbed > DETECT_THRESHOLD, pEmbed: res.pEmbed, chi2: res.chi2 };',
    replace: '  return { flagged: false, pEmbed: res.pEmbed, chi2: res.chi2 };',
    test: 'step 5: filling the picture to capacity IS reported',
    why: 'a detector hard-wired to report nothing',
  },
  {
    id: 'M4',
    file: 'src/first-look.ts',
    anchor: '    const { stego } = embedBitsSpatial(cover, bits);\n    state.cover = cover;',
    replace: '    const stego = cover;\n    state.cover = cover;',
    test: 'step 1: hiding the sentence really changes the picture',
    why: 'an embed that changes nothing while reporting success',
  },
  {
    id: 'M5',
    file: 'src/first-look.ts',
    anchor: '    const out = readFromPicture(state.stego, state.bitCount);',
    replace: '    const out = readFromPicture(state.cover, state.bitCount);',
    test: 'step 3: the sentence comes back out of the picture',
    why: 'the read is pointed at the wrong picture, so the round trip reports a message it never recovered',
  },
];

function run(args) {
  const r = spawnSync('npm', args, { encoding: 'utf8', timeout: 600000, env: { ...process.env, CI: '1' } });
  return { status: r.status, output: (r.stdout ?? '') + (r.stderr ?? '') };
}

function hash() {
  return createHash('sha256')
    .update(
      readdirSync('dist/assets')
        .filter((n) => /\.(css|js)$/.test(n))
        .sort()
        .map((n) => readFileSync('dist/assets/' + n))
        .join('\n'),
    )
    .digest('hex');
}

function ensureBuild() {
  const r = run(['run', 'build']);
  if (r.status !== 0) throw Error('DOES NOT BUILD: ' + r.output);
  return hash();
}

/* A run can fail for reasons that are not the mutation. Those are NOT a kill,
   and reading them as one would report a guard that never fired as one that
   works. */
const nonTestFailure =
  /Executable doesn't exist|browserType\.launch|webServer was not able|Connection refused|ERR_CONNECTION|Cannot find module|No tests found/;

let failed = false;
try {
  for (const c of cases) {
    /* --retries=0 on purpose. With a retry, a mutation that correctly fails
       its first attempt can have the SECOND attempt die of a connection error
       when the preview server goes away, and the output then contains both a
       real assertion failure and ERR_CONNECTION_REFUSED. The guard below
       refuses to count any output carrying an infrastructure error -- rightly,
       since it cannot tell which attempt produced it -- so the honest fix is to
       run one attempt and read it. Observed on M3 before this line existed. */
    const args = ['run', 'test:claims', '--', '--retries=0', '--grep', c.test];
    const baseline = run(args);
    if (baseline.status !== 0) throw Error(c.id + ' BASELINE BLOCKED: ' + baseline.output);

    const original = readFileSync(c.file, 'utf8');
    if (original.split(c.anchor).length !== 2) throw Error(c.id + ' patch anchor is not unique');
    const before = ensureBuild();

    try {
      const modified = original.replace(c.anchor, c.replace);
      if (modified === original) throw Error(c.id + ' patch did not change the file');
      writeFileSync(c.file, modified);

      const after = ensureBuild();
      if (after === before) throw Error(c.id + ' MUTATED BUNDLE DID NOT CHANGE');

      const r = run(args);
      const killed = r.status !== 0 && !nonTestFailure.test(r.output) && /fail/i.test(r.output);
      observations.push({
        id: c.id,
        why: c.why,
        file: c.file,
        owningTest: c.test,
        observed: killed ? 'KILLED' : 'NOT PROVEN',
        baselinePassed: true,
        bundleBefore: before,
        bundleMutated: after,
        exitCode: r.status,
      });
      if (!killed) throw Error(c.id + ' was not proven: ' + r.output);
    } finally {
      writeFileSync(c.file, original);
      const restored = ensureBuild();
      if (restored !== before) throw Error(c.id + ' restore hash differs');
    }
    console.log(`${c.id} KILLED; baseline passed, build succeeded, bundle changed, "${c.test}" failed, source and bundle restored.`);
  }
} catch (e) {
  failed = true;
  observations.push({ observed: 'BLOCKED', reason: e.message });
  console.error(e.message);
}

mkdirSync('audits', { recursive: true });
writeFileSync(
  'audits/mutation-observations.json',
  JSON.stringify({ scope: 'beginner front-section: one patch per rendered verdict', observations }, null, 2) + '\n',
);
if (failed) process.exitCode = 1;
