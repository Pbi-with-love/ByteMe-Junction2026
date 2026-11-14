const STORAGE_KEY = 'agentKitchen.howToPlaySeen';

export function shouldShowHowToPlay(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function markHowToPlaySeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Private browsing and restricted storage should not interrupt play.
  }
}
