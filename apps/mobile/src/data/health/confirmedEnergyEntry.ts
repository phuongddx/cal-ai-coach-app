/**
 * ConfirmedEnergyEntry.swift — a user-confirmed energy value, the ONLY type
 * `createHealthKitService().writeBurnedEnergy` accepts. The brand (an unexported unique
 * symbol) is the enforcement mechanism, exactly as the Swift struct's type is: no
 * initializer path accepts a ScanResponse/ScanItem or any AI-scan-derived type, so a
 * burned-energy write can only originate from a value the user confirmed (the same
 * "one seam owns it" convention as the ED-safe API — never a scattered `if isConfirmed`).
 */

/** A real symbol, not a `declare`: the brand must exist at runtime (Hermes has Symbol). */
const confirmedEnergyBrand = Symbol('confirmedEnergy');

export interface ConfirmedEnergyEntry {
  readonly kcal: number;
  readonly confirmedAt: Date;
  readonly [confirmedEnergyBrand]: true;
}

/** The memberwise init: the seam the confirm sheet (a later unit) will call. */
export function confirmEnergyEntry(kcal: number, confirmedAt: Date): ConfirmedEnergyEntry {
  return { kcal, confirmedAt, [confirmedEnergyBrand]: true };
}
