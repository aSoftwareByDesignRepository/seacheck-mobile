jest.mock('react-native', () => ({
  AppState: { currentState: 'active' },
}));

jest.mock('../src/lib/geo/foregroundGpsDemand', () => ({
  needsForegroundGpsWhileBackgrounded: jest.fn(() => false),
}));

jest.mock('../src/lib/geo/syncForegroundLocationWatch', () => ({
  needsUnifiedBackgroundGps: jest.fn(() => false),
}));

import { AppState } from 'react-native';

import { shouldForegroundPipelineEvaluateAlarms } from '../src/lib/alarms/foregroundAlarmPipeline';

const { needsForegroundGpsWhileBackgrounded } = require('../src/lib/geo/foregroundGpsDemand') as {
  needsForegroundGpsWhileBackgrounded: jest.Mock;
};
const { needsUnifiedBackgroundGps } = require('../src/lib/geo/syncForegroundLocationWatch') as {
  needsUnifiedBackgroundGps: jest.Mock;
};

describe('shouldForegroundPipelineEvaluateAlarms', () => {
  beforeEach(() => {
    AppState.currentState = 'active';
    needsForegroundGpsWhileBackgrounded.mockReturnValue(false);
    needsUnifiedBackgroundGps.mockReturnValue(false);
  });

  it('evaluates when limited foreground-only pipeline is active', async () => {
    needsForegroundGpsWhileBackgrounded.mockReturnValue(true);
    needsUnifiedBackgroundGps.mockReturnValue(false);
    AppState.currentState = 'background';
    await expect(
      shouldForegroundPipelineEvaluateAlarms(async () => true),
    ).resolves.toBe(true);
  });

  it('defers to background task when unified GPS is running even for MOB', async () => {
    needsForegroundGpsWhileBackgrounded.mockReturnValue(true);
    needsUnifiedBackgroundGps.mockReturnValue(true);
    AppState.currentState = 'background';
    await expect(
      shouldForegroundPipelineEvaluateAlarms(async () => true),
    ).resolves.toBe(false);
  });

  it('evaluates when app is active and background task is running', async () => {
    AppState.currentState = 'active';
    needsUnifiedBackgroundGps.mockReturnValue(true);
    await expect(
      shouldForegroundPipelineEvaluateAlarms(async () => true),
    ).resolves.toBe(true);
  });

  it('skips when background task owns alarms', async () => {
    AppState.currentState = 'background';
    needsUnifiedBackgroundGps.mockReturnValue(true);
    await expect(
      shouldForegroundPipelineEvaluateAlarms(async () => true),
    ).resolves.toBe(false);
  });

  it('evaluates in transitional window before background task starts', async () => {
    needsForegroundGpsWhileBackgrounded.mockReturnValue(true);
    AppState.currentState = 'background';
    needsUnifiedBackgroundGps.mockReturnValue(true);
    await expect(
      shouldForegroundPipelineEvaluateAlarms(async () => false),
    ).resolves.toBe(true);
  });

  it('skips when app is backgrounded without unified background eligibility', async () => {
    AppState.currentState = 'background';
    needsUnifiedBackgroundGps.mockReturnValue(false);
    await expect(
      shouldForegroundPipelineEvaluateAlarms(async () => false),
    ).resolves.toBe(false);
  });

  it('fail-opens when background running status is unknown', async () => {
    AppState.currentState = 'inactive';
    needsUnifiedBackgroundGps.mockReturnValue(true);
    await expect(
      shouldForegroundPipelineEvaluateAlarms(async () => {
        throw new Error('native unavailable');
      }),
    ).resolves.toBe(true);
  });
});
