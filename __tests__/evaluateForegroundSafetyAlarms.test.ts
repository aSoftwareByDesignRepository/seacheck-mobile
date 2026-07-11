jest.mock('react-native', () => ({
  AppState: { currentState: 'active' },
}));

jest.mock('../src/lib/alarms/foregroundAlarmPipeline', () => ({
  shouldForegroundPipelineEvaluateAlarms: jest.fn(async () => true),
}));

jest.mock('../src/lib/alarms/alarmCoordinator', () => ({
  processFixFromLocation: jest.fn(async () => ({ legAdvancePromptLegIdx: null })),
}));

import { AppState } from 'react-native';

import { evaluateForegroundSafetyAlarms } from '../src/lib/alarms/evaluateForegroundSafetyAlarms';
import { processFixFromLocation } from '../src/lib/alarms/alarmCoordinator';
import { shouldForegroundPipelineEvaluateAlarms } from '../src/lib/alarms/foregroundAlarmPipeline';

const { shouldForegroundPipelineEvaluateAlarms: shouldEvaluate } = require('../src/lib/alarms/foregroundAlarmPipeline') as {
  shouldForegroundPipelineEvaluateAlarms: jest.Mock;
};

jest.mock('../src/services/locationService', () => ({
  isFixStale: jest.fn(() => false),
  useLocationStore: {
    getState: jest.fn(() => ({
      fix: {
        latitude: 54.1,
        longitude: 10.2,
        speedMs: 1,
        heading: 90,
        accuracyM: 5,
        altitudeM: 0,
        timestamp: Date.now(),
      },
    })),
  },
}));

describe('evaluateForegroundSafetyAlarms', () => {
  const { useLocationStore } = require('../src/services/locationService') as {
    useLocationStore: { getState: jest.Mock };
  };

  beforeEach(() => {
    AppState.currentState = 'active';
    shouldEvaluate.mockResolvedValue(true);
    (processFixFromLocation as jest.Mock).mockClear();
    useLocationStore.getState.mockReturnValue({
      fix: {
        latitude: 54.1,
        longitude: 10.2,
        speedMs: 1,
        heading: 90,
        accuracyM: 5,
        altitudeM: 0,
        timestamp: Date.now(),
      },
    });
  });

  it('skips when foreground pipeline does not own alarms', async () => {
    shouldEvaluate.mockResolvedValue(false);
    await expect(
      evaluateForegroundSafetyAlarms({
        liveState: {
          anchorAlarm: { active: true, latitude: 1, longitude: 2, radiusNm: 0.05, triggered: false },
          goToTarget: null,
          mobTarget: null,
          alarmLimits: { xteNm: 0.05, arrivalNm: 0.25 },
          activeLegIndex: 0,
          activePassageId: null,
          passageDetail: null,
          legAdvanceAuto: false,
        },
      }),
    ).resolves.toBeNull();
    expect(processFixFromLocation).not.toHaveBeenCalled();
  });

  it('evaluates anchor alarms even when heartbeat disables leg prompts', async () => {
    AppState.currentState = 'background';
    await evaluateForegroundSafetyAlarms({
      liveState: {
        anchorAlarm: { active: true, latitude: 1, longitude: 2, radiusNm: 0.05, triggered: false },
        goToTarget: null,
        mobTarget: null,
        alarmLimits: { xteNm: 0.05, arrivalNm: 0.25 },
        activeLegIndex: 0,
        activePassageId: null,
        passageDetail: null,
        legAdvanceAuto: false,
      },
      allowLegAdvancePrompt: false,
    });
    expect(processFixFromLocation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowLegAdvancePrompt: false, inBackground: true }),
    );
  });

  it('evaluates anchor GPS-lost on heartbeat when no fix is in the store', async () => {
    useLocationStore.getState.mockReturnValue({ fix: null });

    await evaluateForegroundSafetyAlarms({
      liveState: {
        anchorAlarm: { active: true, latitude: 1, longitude: 2, radiusNm: 0.05, triggered: false },
        goToTarget: null,
        mobTarget: null,
        alarmLimits: { xteNm: 0.05, arrivalNm: 0.25 },
        activeLegIndex: 0,
        activePassageId: null,
        passageDetail: null,
        legAdvanceAuto: false,
      },
      allowLegAdvancePrompt: false,
    });

    expect(processFixFromLocation).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: expect.any(Number) }),
      expect.objectContaining({ allowLegAdvancePrompt: false }),
    );
  });
});
