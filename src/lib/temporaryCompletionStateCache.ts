const STORAGE_KEY = 'taskora_temporary_study_completion_states';

export type CompletionStateMap = Record<string, boolean>;

export function readTemporaryCompletionStates(): CompletionStateMap {
  const serialized = localStorage.getItem(STORAGE_KEY);
  if (!serialized) return {};

  const parsed: unknown = JSON.parse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Temporary completion data is invalid.');
  }

  const states: CompletionStateMap = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'boolean') {
      throw new Error('Temporary completion data is invalid.');
    }
    states[key] = value;
  }
  return states;
}

export function writeTemporaryCompletionState(key: string, completed: boolean): void {
  const states = readTemporaryCompletionStates();
  states[key] = completed;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
}
