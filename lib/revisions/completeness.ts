/**
 * Step-completeness checks for the configurator wizard.
 *
 * A step is "complete" once the fields it owns are all present on the
 * revision's JSON blobs. Used by:
 *   - the WizardShell left-nav to gray out upcoming steps so reps can't
 *     jump ahead without finishing the current one
 *   - each step page's server guard to redirect URL-manipulation attempts
 *     back to the earliest unfinished step
 *
 * Ordering matches the STEPS array in WizardShell:
 *   step-1 → step-2 → review → send
 *
 * "Review" reads all of step-1 + step-2's data, so it's complete iff they
 * both are. "Send" tracks whether the customer confirmed and fired the
 * mailto (we use `totalPrice` as the commit marker, since that only gets
 * stamped by `saveRecipientForQuote`).
 */

export type StepPath = 'step-1' | 'step-2' | 'review' | 'send';

export type StepCompleteness = Record<StepPath, boolean>;

export function computeStepCompleteness(args: {
  revision: {
    service: unknown;
    certs: unknown;
    site: unknown;
    geometry: unknown;
    wallBuildup: unknown;
  };
  quote: {
    totalPrice: number | null;
  };
}): StepCompleteness {
  const svc = (args.revision.service ?? {}) as any;
  const certs = (args.revision.certs ?? {}) as any;
  const site = (args.revision.site ?? {}) as any;
  const geom = (args.revision.geometry ?? {}) as any;
  const wall = (args.revision.wallBuildup ?? {}) as any;

  const step1 =
    !!svc.chemical?.trim?.() &&
    !!svc.chemicalFamily &&
    Number.isFinite(svc.operatingTempF) &&
    Number.isFinite(svc.designTempF) &&
    Number.isFinite(svc.specificGravity) &&
    !!wall.resinId &&
    // Seismic must be from an actual calculation — not defaults. Ss, S1,
    // and wind V are all required > 0 before the step is considered done.
    !!site.seismic &&
    Number.isFinite(site.seismic?.Ss) && site.seismic.Ss > 0 &&
    Number.isFinite(site.seismic?.S1) && site.seismic.S1 >= 0 &&
    !!site.wind &&
    Number.isFinite(site.wind?.V) && site.wind.V > 0 &&
    // certs always saves (even as empty object), so only check it exists
    !!certs !== null;

  const step2 =
    step1 &&
    Number.isFinite(geom.idIn) &&
    Number.isFinite(geom.ssHeightIn) &&
    Number.isFinite(geom.freeboardIn) &&
    !!geom.orientation &&
    !!geom.topHead &&
    !!geom.bottom;

  const review = step1 && step2;

  const send = review && args.quote.totalPrice != null;

  return { 'step-1': step1, 'step-2': step2, review, send };
}

/**
 * Given the current step and completeness map, pick the earliest step
 * the rep should still be on. Used for guarded redirects when a user
 * tries to jump ahead via URL.
 *
 *   - If the requested step's prerequisites aren't done → earliest unfinished step
 *   - Else → the requested step
 */
export function resolveGuardedStep(
  requested: StepPath,
  completeness: StepCompleteness,
): StepPath {
  const order: StepPath[] = ['step-1', 'step-2', 'review', 'send'];
  const requestedIdx = order.indexOf(requested);

  // Each step requires the PREVIOUS step's fields — we walk left-to-right
  // and return the first incomplete step found.
  for (let i = 0; i < requestedIdx; i++) {
    if (!completeness[order[i]]) return order[i];
  }
  return requested;
}
