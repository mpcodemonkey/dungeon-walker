import { Pedometer } from 'expo-sensors';
import type { PedometerStatus, StepSource } from './stepSource.types';

// iOS: CMPedometer via expo-sensors, works inside Expo Go. The system
// motion-permission prompt (NSMotionUsageDescription) is triggered
// automatically on first access — no separate request call needed.
export const stepSource: StepSource = {
  async initialize(): Promise<PedometerStatus> {
    const available = await Pedometer.isAvailableAsync();
    return available ? 'active' : 'unavailable';
  },

  async getStepCountSince(since: Date): Promise<number> {
    const { steps } = await Pedometer.getStepCountAsync(since, new Date());
    return steps;
  },
};
