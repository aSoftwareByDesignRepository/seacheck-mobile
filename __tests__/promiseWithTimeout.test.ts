import { promiseWithTimeout, TimeoutError } from '../src/lib/async/promiseWithTimeout';

describe('promiseWithTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves when the promise settles before the deadline', async () => {
    const result = promiseWithTimeout(Promise.resolve('ok'), 1000, 'test');
    await expect(result).resolves.toBe('ok');
  });

  it('rejects with TimeoutError when the deadline passes first', async () => {
    const pending = new Promise<string>(() => {});
    const result = promiseWithTimeout(pending, 500, 'slow-task');
    jest.advanceTimersByTime(500);
    await expect(result).rejects.toBeInstanceOf(TimeoutError);
    await expect(result).rejects.toMatchObject({ label: 'slow-task' });
  });

  it('forwards rejection from the wrapped promise', async () => {
    await expect(promiseWithTimeout(Promise.reject(new Error('boom')), 1000, 'fail')).rejects.toThrow('boom');
  });
});
