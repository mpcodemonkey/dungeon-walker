import {
  getSdkStatus,
  initialize,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { PedometerStatus, StepSource } from './stepSource.types';

// Android: expo-sensors' Pedometer is unreliable on Android (documented
// upstream issues — permission resolves but watchStepCount never fires).
// Health Connect is Android's standard fitness data store instead. This
// requires a custom dev client — Health Connect's native module can't run
// inside Expo Go. See docs/chunk-3-movement.md.
let permissionGranted = false;

export const stepSource: StepSource = {
  async initialize(): Promise<PedometerStatus> {
    try {
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        // Most likely cause: the Health Connect app isn't installed (only
        // built into the OS on Android 14+; earlier versions need it from
        // the Play Store).
        return 'unavailable';
      }

      const initialized = await initialize();
      if (!initialized) {
        return 'unavailable';
      }

      const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
      permissionGranted = granted.some(
        (permission) => 'recordType' in permission && permission.recordType === 'Steps'
      );
      return permissionGranted ? 'active' : 'permission-denied';
    } catch {
      return 'unavailable';
    }
  },

  async getStepCountSince(since: Date): Promise<number> {
    if (!permissionGranted) return 0;

    const { records } = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: since.toISOString(),
        endTime: new Date().toISOString(),
      },
    });
    return records.reduce((total, record) => total + record.count, 0);
  },
};
