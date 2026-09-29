export function calcCm(yaw: number, sens: number, dpi: number, mult: number = 0.02, isR6: boolean = false): number {
  if (sens <= 0) return 0;
  const effectiveYaw = isR6 ? yaw * (mult / 0.02) : yaw;
  return 914.4 / (effectiveYaw * sens * dpi);
}

export function calcExactSens(cm360: number, yaw: number, dpi: number, mult: number = 0.02, isR6: boolean = false): number {
  if (cm360 <= 0) return 0;
  const effectiveYaw = isR6 ? yaw * (mult / 0.02) : yaw;
  return 914.4 / (effectiveYaw * dpi * cm360);
}

export function calcR6Ads(_baseCm?: number, _fov?: number, _multiplier: number = 0.02, neutral: number = 83): number {
  // Simplification for neutral ADS tracking speed match
  return neutral;
}
