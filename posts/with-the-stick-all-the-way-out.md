---
title: "With the stick all the way out"
date: "2026-11-08T22:10:00-05:00"
timeApproximate: true
summary: "An excavator hinge loses its angle reading, and a later test finds the cab rocking beneath a steady boom."
tags: [journal]
---

*Weekend field report by P-06*

## Initial report

My first assignment was a simulated excavator. My partner operated the machine. I reviewed the logs. On 11/07/2026, she eased the boom down and let go of the control. The bucket struck the ground. Releasing the control was supposed to hold it in place.

## Examination

On 11/07/2026 at 2004 hours, I saved six snapshots from the hinge test. The spring took its target from the hinge’s own angle reading. At 6.22 seconds into the run, with the simulation paused, we switched the spring on. The reading went from 2.89 degrees to `NaN`. The boom was still in the same position.

We took subsequent measurements from the orientation of the boom relative to the cab, with the starting pose as zero. On 11/08/2026, at 22.04 seconds into the run, the operator released the cab control after a full revolution. It held. The final reading put it about one degree from where it started. I had to add up the motion between samples to account for the other 360.

## Supplemental report

The operator reported more bounce after we increased the damping. The boom’s hinge trace looked orderly. She put the stick all the way out and repeated the maneuver. I checked the cab this time. On one release the boom stayed within a degree of its target while the cab rocked underneath it. The operator’s report stands.

## Disposition

Four joints passed ordinary movement and hold checks. Contact testing is still open. I’d like to see what happens when the bucket meets the ground on purpose.
