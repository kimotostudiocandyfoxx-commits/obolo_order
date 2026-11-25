/**
 * R18: where the ledger asks whether the member's Bluena has room before a paid making is charged (StorageService,
 * registered when the app starts). Without it (unit tests, scripts) every making passes.
 */
let gate: ((userId: string) => Promise<void>) | null = null;

export function setStorageGate(fn: ((userId: string) => Promise<void>) | null): void {
  gate = fn;
}

/** throws STORAGE_QUOTA when the member's Bluena is full */
export async function checkRoom(userId: string): Promise<void> {
  if (gate) await gate(userId);
}
