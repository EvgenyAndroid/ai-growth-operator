/**
 * lib/measurement — the Prove-It engine (PRD 14/15 + 26A.1/26A.2).
 *
 * Surface:
 *   constants     — PRD 14.4 disclosure, PRD 15.2/15.4 metric lists, language guard
 *   mode          — single-mode resolution incl. 26A.1 activation downgrade
 *   holdout       — seeded 10% customer-level assignment + persistence (14.3, 26B.14)
 *   contamination — clean-holdout risk checks (14.4, 26A.5)
 *   windows       — 26A.2 default measurement windows
 *   lift          — refund-netted lift RANGE with uncertainty band (14.5)
 *   readouts      — builders for the three (and only three) labels
 *   simulate      — PRD 20.4 demo examples (holdout / no-control / directional Meta)
 */

export * from "./constants";
export * from "./mode";
export * from "./holdout";
export * from "./contamination";
export * from "./windows";
export * from "./lift";
export * from "./readouts";
export * from "./simulate";
