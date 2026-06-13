import type { Question, QuestionType } from './types';

export function parseQuestionsText(text: string, examId: string): Omit<Question, 'id'>[] {
  const blocks = text.trim().split(/\n(?=\d+\.)/).filter(b => b.trim());
  const questions: Omit<Question, 'id'>[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const firstLine = lines[0].replace(/^\d+\.\s*/, '');
    const options: string[] = [];
    let answerLine = '';
    const contentLines: string[] = [firstLine];

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      if (/^[①②③④⑤]|^[1-4]\)/.test(line)) {
        options.push(line.replace(/^[①②③④⑤]|^[1-4]\)\s*/, '').trim());
      } else if (/^정답\s*[:：]/.test(line)) {
        answerLine = line.replace(/^정답\s*[:：]\s*/, '').trim();
      }
    }

    let type: QuestionType = 'short';
    if (options.length >= 2) {
      type = 'multiple';
    } else if (/^(O|X|o|x|예|아니오|맞다|틀리다)$/i.test(answerLine)) {
      type = 'ox';
    }

    questions.push({
      examId,
      order: i + 1,
      type,
      content: contentLines.join(' '),
      options: type === 'multiple' ? options : undefined,
      answer: answerLine,
      score: 1,
    });
  }

  return questions;
}
