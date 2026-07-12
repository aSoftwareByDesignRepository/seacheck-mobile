import { installGlobalErrorLogging } from '../src/shell/installGlobalErrorLogging';

describe('installGlobalErrorLogging', () => {
  const original = (globalThis as typeof globalThis & { ErrorUtils?: unknown }).ErrorUtils;

  afterEach(() => {
    (globalThis as typeof globalThis & { ErrorUtils?: unknown }).ErrorUtils = original;
  });

  it('no-ops when global ErrorUtils is unavailable', () => {
    delete (globalThis as typeof globalThis & { ErrorUtils?: unknown }).ErrorUtils;
    expect(() => installGlobalErrorLogging()).not.toThrow();
  });

  it('wraps the default handler and logs layout failures', () => {
    const defaultHandler = jest.fn();
    const setGlobalHandler = jest.fn();
    (globalThis as typeof globalThis & { ErrorUtils?: unknown }).ErrorUtils = {
      getGlobalHandler: () => defaultHandler,
      setGlobalHandler,
    };

    installGlobalErrorLogging();

    expect(setGlobalHandler).toHaveBeenCalledTimes(1);
    const wrapped = setGlobalHandler.mock.calls[0][0] as (error: unknown, isFatal?: boolean) => void;
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    wrapped(new Error('layout overflow in map chrome'), true);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[GlobalError] layout handler failure',
      expect.objectContaining({ isFatal: true, message: 'layout overflow in map chrome' }),
    );
    expect(defaultHandler).toHaveBeenCalledWith(expect.any(Error), true);

    consoleSpy.mockRestore();
  });
});
