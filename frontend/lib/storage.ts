export const NOTE_STORAGE_KEY = "dateChecklistNote";

export function loadSavedNote(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NOTE_STORAGE_KEY) || "";
}

export function saveNoteToStorage(note: string): void {
  localStorage.setItem(NOTE_STORAGE_KEY, note);
}
