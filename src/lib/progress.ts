import { formatPaise } from '@/lib/money';

export interface ProgressReportTextInput {
  childFirst: string;
  attendanceRate: number | null;
  attendedClasses: number;
  totalClasses: number;
  classesFinished: number;
  homeworkDone: number;
  homeworkOpen: number;
  outstandingFeePaise: number;
}

/**
 * Deterministic WhatsApp wording for a student's progress (ADR 0005). Both
 * implementations build the share text through this one helper, so the demo
 * and the real academy never drift apart word for word.
 */
export function progressReportText(input: ProgressReportTextInput): string {
  const parts: string[] = [];
  if (input.totalClasses === 0) {
    parts.push('No classes were held recently.');
  } else {
    const pct = input.attendanceRate ?? 0;
    parts.push(`Attendance ${pct}% (${input.attendedClasses} of ${input.totalClasses} classes).`);
  }
  parts.push(`Classes finished: ${input.classesFinished}.`);
  parts.push(
    input.homeworkOpen > 0
      ? `Homework: ${input.homeworkDone} done, ${input.homeworkOpen} still open.`
      : `Homework: ${input.homeworkDone} done.`,
  );
  if (input.outstandingFeePaise > 0) {
    parts.push(`Fee still due: ${formatPaise(input.outstandingFeePaise)}.`);
  } else {
    parts.push('Fees: all clear.');
  }
  return `${input.childFirst}'s progress: ${parts.join(' ')}`;
}
