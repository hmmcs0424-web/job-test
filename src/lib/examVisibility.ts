import type { Exam } from './types';

// 마감된 시험의 결과를 상담사에게 아직 노출해도 되는지 여부.
// resultVisibleUntil이 없으면 무기한 노출, 있으면 해당 날짜까지만 노출.
export function isResultStillVisible(exam: Exam): boolean {
  if (!exam.resultVisibleUntil) return true;
  const today = new Date().toISOString().slice(0, 10);
  return today <= exam.resultVisibleUntil;
}
