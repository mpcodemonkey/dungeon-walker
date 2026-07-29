export type PedometerStatus = 'checking' | 'unavailable' | 'permission-denied' | 'active';

// Platform-specific implementations: stepSource.ios.ts (expo-sensors'
// Pedometer, works in Expo Go) and stepSource.android.ts (Health Connect,
// requires a custom dev client — see docs/chunk-3-movement.md).
export interface StepSource {
  initialize(): Promise<PedometerStatus>;
  // Total steps recorded from `since` through now.
  getStepCountSince(since: Date): Promise<number>;
}
