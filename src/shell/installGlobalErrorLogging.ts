type ErrorHandler = (error: unknown, isFatal?: boolean) => void;

type GlobalErrorUtils = {
  getGlobalHandler(): ErrorHandler;
  setGlobalHandler(handler: ErrorHandler): void;
};

let installed = false;

function getErrorUtils(): GlobalErrorUtils | undefined {
  return (globalThis as typeof globalThis & { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
}

/** Wrap the RN global handler once the runtime is ready (not at bundle load time). */
export function installGlobalErrorLogging(): void {
  if (installed) return;

  const errorUtils = getErrorUtils();
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return;

  installed = true;

  const defaultHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (error instanceof Error && /layout/i.test(error.message)) {
      console.error('[GlobalError] layout handler failure', {
        isFatal,
        message: error.message,
        stack: error.stack,
      });
    }
    defaultHandler(error, isFatal);
  });
}
