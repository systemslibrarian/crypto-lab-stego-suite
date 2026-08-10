/**
 * Known WCAG 1.4.11 / generated-content findings in this lab, captured through
 * the gate's own path so the baseline and the check cannot disagree.
 *
 * THIS FILE IS A TO-DO LIST, NOT A SET OF EXEMPTIONS. The gate ratchets on it:
 *   - a finding NOT listed here fails the run, so a regression cannot land;
 *   - a listed finding whose ratio gets WORSE fails, so the list cannot rot;
 *   - a listed finding that no longer appears ALSO fails, so a fixed entry must
 *     be deleted and the file can only shrink toward empty.
 * The last rule is what stops an allowlist becoming a permanent exemption.
 *
 * `unverified: true` marks an absolutely-positioned pseudo-element. It can paint
 * outside its host and the oracle measures it against the host's backdrop, so
 * that ratio is NOT trustworthy — hand-measure before acting on it.
 */
export const NONTEXT_BASELINE: Record<
  string,
  { ratio: number; required: number; unverified: boolean }
> = {
  "control-boundary|button#adapt-compare": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#adapt-embed": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#adapt-map": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#adapt-seq": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#chi-run-curve": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#chi-test-cover": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#chi-test-stego": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#cl-theme-toggle.cl-btn.cl-icon": { ratio: 1.83, required: 3.0, unverified: false },
  "control-boundary|button#cover-sample.ghost": { ratio: 1.05, required: 3.0, unverified: false },
  "control-boundary|button#dct-embed": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#dct-extract": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#dct-inverse": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#dct-transform": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#lsb-download": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#lsb-embed": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#lsb-extract": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#lsb-reset.ghost": { ratio: 1.46, required: 3.0, unverified: false },
  "control-boundary|button#lsb-walk-next": { ratio: 1.3, required: 3.0, unverified: false },
  "control-boundary|button#lsb-walk-prev.ghost": { ratio: 1.3, required: 3.0, unverified: false },
  "control-boundary|button#lsb-walk-reset.ghost": { ratio: 1.3, required: 3.0, unverified: false },
  "control-boundary|button.copy-btn": { ratio: 1.46, required: 3.0, unverified: false }
};
