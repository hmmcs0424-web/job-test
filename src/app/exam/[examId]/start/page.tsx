'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getExam, getQuestions, addResult, getResultByExamAndStaff } from '@/lib/firestore';
import { getStaffSession } from '@/lib/session';
import { splitAnswer, joinAnswer, isAnswerCorrect } from '@/lib/answer';
import type { Exam, Question } from '@/lib/types';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ExamStart() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);
  const startedAt = useRef(new Date().toISOString());
  const staff = getStaffSession();

  useEffect(() => {
    if (!staff) { router.push('/exam/login'); return; }

    Promise.all([getExam(examId), getQuestions(examId)]).then(async ([exam, qs]) => {
      if (!exam) { router.push('/exam/list'); return; }

      const existing = await getResultByExamAndStaff(examId, staff.id);
      if (existing) { router.push('/exam/list'); return; }

      setExam(exam);
      // 문항 순서 셔플 + 각 문항의 보기(options) 순서도 셔플
      const shuffled = shuffleArray(qs).map((q, idx) => ({
        ...q,
        _displayOrder: idx + 1,
        options: q.options ? shuffleArray(q.options) : undefined,
      }));
      setQuestions(shuffled);
      setTimeLeft(exam.timeLimit * 60);
      setLoading(false);
    });
  }, [examId]);

  useEffect(() => {
    if (!started || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, timeLeft]);

  async function handleSubmit() {
    if (submitting || submitted || !staff || !exam) return;
    setSubmitting(true);

    const answerRecords: Record<string, { given: string; isCorrect: boolean; score: number }> = {};
    let total = 0;
    let max = 0;

    for (const q of questions) {
      const given = answers[q.id] ?? '';
      const correct = isAnswerCorrect(given, q.answer);
      const score = correct ? q.score : 0;
      answerRecords[q.id] = { given, isCorrect: correct, score };
      total += score;
      max += q.score;
    }

    await addResult({
      examId,
      examTitle: exam.title,
      staffId: staff.id,
      staffName: staff.name,
      staffEmployeeId: staff.employeeId,
      partId: staff.partId,
      startedAt: startedAt.current,
      submittedAt: new Date().toISOString(),
      answers: answerRecords,
      totalScore: total,
      maxScore: max,
      passed: total >= max * 0.6,
      editHistory: [],
    });

    setSubmitted(true);
    setSubmitting(false);
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">제출 완료</h2>
          <p className="text-gray-500 mb-6">시험이 정상적으로 제출되었습니다.<br />결과는 시험 마감 후 확인할 수 있습니다.</p>
          <button
            onClick={() => router.push('/exam/list')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-semibold"
          >
            목록으로
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
          <button onClick={() => router.push('/exam/list')} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 text-sm">
            ← 돌아가기
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{exam?.title}</h2>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm text-gray-600">
            <p>📋 총 <strong>{questions.length}</strong>문제</p>
            <p>⏱ 제한 시간 <strong>{exam?.timeLimit}분</strong></p>
            <p>⚠️ 제출 후 답안 수정 불가</p>
            <p>⚠️ 결과는 시험 마감 후 공개됩니다</p>
          </div>
          <button
            onClick={() => { startedAt.current = new Date().toISOString(); setStarted(true); }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-semibold"
          >
            시험 시작
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white shadow-sm z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold text-gray-800 truncate">{exam?.title}</div>
          <div className={`font-mono font-bold text-lg px-3 py-1 rounded-lg ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white text-sm font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
              <div className="flex-1">
                <p className="text-gray-900 font-medium leading-relaxed">{q.content}</p>
                {q.imageUrl && (
                  <img src={q.imageUrl} alt="문제 이미지" className="mt-3 max-w-full rounded-xl border border-gray-200" />
                )}
              </div>
            </div>
            <div className="ml-10">
              {q.type === 'multiple' && q.options && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-1">※ 정답이 여러 개일 수 있습니다. 해당하는 보기를 모두 선택하세요.</p>
                  {q.options.map((opt, oi) => {
                    const selectedList = splitAnswer(answers[q.id] ?? '');
                    const selected = selectedList.includes(opt);
                    return (
                      <label key={oi}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all
                          ${selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                        <input type="checkbox" name={q.id} value={opt} checked={selected}
                          onChange={() => {
                            const next = selected ? selectedList.filter(o => o !== opt) : [...selectedList, opt];
                            setAnswers(prev => ({ ...prev, [q.id]: joinAnswer(next) }));
                          }} className="sr-only" />
                        {/* 커스텀 체크박스 */}
                        <span className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                          ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                          {selected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-sm leading-relaxed ${selected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {q.type === 'ox' && (
                <div className="flex gap-3">
                  {['O', 'X'].map(v => (
                    <label key={v} className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all text-xl font-bold ${answers[q.id] === v ? (v === 'O' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-red-500 bg-red-50 text-red-600') : 'border-gray-200 hover:border-gray-300 text-gray-500'}`}>
                      <input type="radio" name={q.id} value={v} checked={answers[q.id] === v} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: v }))} className="sr-only" />
                      {v}
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'short' && (
                <input
                  type="text"
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="답을 입력하세요"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              )}
              {q.type === 'long' && (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="답을 자세히 입력하세요"
                  rows={5}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 resize-none"
                />
              )}
            </div>
          </div>
        ))}

        <div className="sticky bottom-4">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl py-4 font-bold text-lg shadow-lg transition-colors"
          >
            {submitting ? '제출 중...' : '최종 제출'}
          </button>
        </div>
      </main>
    </div>
  );
}
