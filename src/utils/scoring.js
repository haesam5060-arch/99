// Calculate score based on elapsed time in seconds (10s timer)
export function calculateScore(elapsedSeconds) {
  if (elapsedSeconds <= 1) return 100;
  if (elapsedSeconds <= 2) return 90;
  if (elapsedSeconds <= 3) return 80;
  if (elapsedSeconds <= 4) return 70;
  if (elapsedSeconds <= 5) return 60;
  if (elapsedSeconds <= 6) return 50;
  if (elapsedSeconds <= 7) return 40;
  if (elapsedSeconds <= 8) return 30;
  if (elapsedSeconds <= 9) return 20;
  if (elapsedSeconds <= 10) return 10;
  return 0; // should not happen since timeout is at 10s
}

export const WRONG_PENALTY = -10;
export const TIMEOUT_PENALTY = -10;
export const CHARACTER_PRICE = 1000;
export const FALL_DURATION = 10; // seconds
