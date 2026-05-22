export type HeightUnit = 'mm' | 'cm' | 'm'
export type VolumeUnit = 'L' | 'gal'

export interface DisplayUnits {
  height: HeightUnit
  volume: VolumeUnit
}

export const DEFAULT_UNITS: DisplayUnits = { height: 'cm', volume: 'L' }

export function convertHeight(meters: number, unit: HeightUnit): number {
  if (unit === 'mm') return meters * 1000
  if (unit === 'cm') return meters * 100
  return meters
}

export function convertVolume(liters: number, unit: VolumeUnit): number {
  if (unit === 'gal') return liters / 3.78541
  return liters
}

export function fmtHeight(meters: number, unit: HeightUnit, decimals = 2): string {
  return `${convertHeight(meters, unit).toFixed(decimals)} ${unit}`
}

export function fmtVolume(liters: number, unit: VolumeUnit, decimals = 1): string {
  return `${convertVolume(liters, unit).toFixed(decimals)} ${unit}`
}
