import type { Question, QuestionType, Explanation, ExplanationLink } from './types';

/**
 * 일괄 등록 형식:
 *
 * 1. 문제 내용
 * 보기1
 * 보기2
 * 보기3
 * 보기4
 * 정답 : 보기텍스트
 * 해설 : 설명 (선택)
 * 링크 : https://... (선택)
 *
 * - 객관식: 정답 앞에 보기가 2개 이상 있으면 자동 감지
 * - 단답형: 보기 없이 정답만
 * - OX형: 정답이 O 또는 X
 * - 장문형: 문제 첫 줄에 [장문] 포함
 * - 정답/해설 앞뒤 공백 허용 (예: "정답 :", "정답:")
 */
export function parseQuestionsText(text: string, examId: string): Omit<Question, 'id'>[] {
  // 숫자. 으로 시작하는 줄 기준으로 블록 분리
  const blocks = text.trim().split(/\n(?=\s*\d+[\.\)])/).filter(b => b.trim());
  const questions: Omit<Question, 'id'>[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    // 첫 줄: 번호 제거
    const firstLine = lines[0].replace(/^\s*\d+[\.\)]\s*/, '');
    const isLong = /^\[장문\]/i.test(firstLine);
    const content = firstLine.replace(/^\[장문\]\s*/i, '').trim();
    if (!content) continue;

    const options: string[] = [];
    let answerLine = '';
    const explanationParts: string[] = [];
    const links: ExplanationLink[] = [];
    let linkCounter = 0;
    let parsingMode: 'options' | 'answer' | 'explanation' = 'options';

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];

      // 정답 감지 (공백 허용: "정답:", "정답 :", "정답 : ")
      if (/^정답\s*[:：]/.test(line)) {
        parsingMode = 'answer';
        const val = line.replace(/^정답\s*[:：]\s*/, '').trim();
        answerLine = val;
        continue;
      }

      // 해설/풀이 감지
      if (/^(해설|풀이)\s*[:：]/.test(line)) {
        parsingMode = 'explanation';
        const val = line.replace(/^(해설|풀이)\s*[:：]\s*/, '').trim();
        if (val) explanationParts.push(val);
        continue;
      }

      // 링크 감지
      if (/^링크\s*[:：]/.test(line)) {
        const url = line.replace(/^링크\s*[:：]\s*/, '').trim();
        if (url) {
          linkCounter++;
          links.push({ label: `참고 링크 ${linkCounter}`, url });
        }
        continue;
      }

      // 정답·해설 이후 텍스트는 해설로 이어 붙이기
      if (parsingMode === 'answer' || parsingMode === 'explanation') {
        explanationParts.push(line);
        continue;
      }

      // 정답 이전 = 보기 줄 (앞에 ①②③④ 또는 숫자) 제거 후 저장)
      const cleanedOption = line
        .replace(/^[①②③④⑤]\s*/, '')
        .replace(/^[1-5][\.\)]\s*/, '')
        .trim();
      if (cleanedOption) options.push(cleanedOption);
    }

    // 타입 결정
    let type: QuestionType;
    if (isLong) {
      type = 'long';
    } else if (options.length >= 2) {
      type = 'multiple';
    } else if (/^[OXox]$/.test(answerLine)) {
      type = 'ox';
      answerLine = answerLine.toUpperCase();
    } else {
      type = 'short';
    }

    // 풀이 구성
    const explanationText = explanationParts.join('\n').trim();
    const explanation: Explanation | undefined =
      explanationText || links.length > 0
        ? {
            ...(explanationText ? { text: explanationText } : {}),
            ...(links.length > 0 ? { links } : {}),
          }
        : undefined;

    // undefined 없이 안전하게 구성
    const q: Omit<Question, 'id'> = {
      examId,
      order: i + 1,
      type,
      content,
      answer: answerLine,
      score: 1,
      ...(type === 'multiple' && options.length > 0 ? { options } : {}),
      ...(explanation ? { explanation } : {}),
    };

    questions.push(q);
  }

  return questions;
}
