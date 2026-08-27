import { AlertLevel } from '../enums/alert-level.enum.js';

export interface AdvisoryResult {
  level: AlertLevel;
  message?: string;
  recommendation?: string;
}

export function green(message?: string): AdvisoryResult {
  return { level: AlertLevel.VERT, message };
}

export function yellow(
  message: string,
  recommendation?: string,
): AdvisoryResult {
  return { level: AlertLevel.JAUNE, message, recommendation };
}

export function red(message: string, recommendation?: string): AdvisoryResult {
  return { level: AlertLevel.ROUGE, message, recommendation };
}
