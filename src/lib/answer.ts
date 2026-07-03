// 객관식 복수 정답을 하나의 문자열로 저장하기 위한 구분자 및 헬퍼
export const ANSWER_DELIM = '|||';

export function splitAnswer(answer: string): string[] {
  return answer.split(ANSWER_DELIM).map(s => s.trim()).filter(Boolean);
}

export function joinAnswer(list: string[]): string {
  return list.join(ANSWER_DELIM);
}

export function formatAnswerDisplay(answer: string): string {
  return splitAnswer(answer).join(', ');
}

export function isAnswerCorrect(given: string, answer: string): boolean {
  const g = splitAnswer(given);
  const a = new Set(splitAnswer(answer));
  return g.length === a.size && g.every(v => a.has(v));
}
