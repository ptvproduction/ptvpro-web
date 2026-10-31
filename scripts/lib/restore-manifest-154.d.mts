export function compareRestoreManifests(original: unknown, restored: unknown): {
  equal: boolean;
  changedSections: string[];
  reviewedCastReformats: number;
};
