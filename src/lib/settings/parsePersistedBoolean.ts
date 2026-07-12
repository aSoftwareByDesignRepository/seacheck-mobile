/** Strict boolean restore from AsyncStorage JSON — rejects truthy strings like "false". */
export function parsePersistedBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
