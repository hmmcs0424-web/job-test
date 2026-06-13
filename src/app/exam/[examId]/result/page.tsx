'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getExam, getQuestions, getResultByExamAndStaff } from '@/lib/firestore';
import { getStaffSession } from '@/lib/session';
import type { Exam, Question, Result } from '@/lib/types';

export default function ExamResult() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const staff = getStaffSession();

  useEffect(() => {
    if (!staff) { router.push('/exam/login'); return; }
    Promise.all([getExam(examId), getQuestions(examId), getResultByExamAndStaff(examId, staff.id)])
      .then(([exam, qs, result]) => {
        if (!exam || !result) { router.push('/exam/list'); return; }
        if (exam.status !== 'closed') { router.push('/exam/list'); return; }
        setExam(exam);
        setQuestions(qs);
        setResult(result);
        setLoading(false);
      });
  }, [examId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  }

  const pct = result && result.maxScore > 0 ? Math.round((result.totalScore / result.maxScore) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/exam/list')} className="text-gray-400 hover:text-gray-600 text-sm">← 목록으로</button>
          <h1 className="font-bold text-gray-900">{exam?.title}</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="text-center">
            <div className={`text-5xl font-bold mb-2 ${pct >= 60 ? 'text-blue-600' : 'text-red-500'}`}>{pct}점</div>
            <div className="text-gray-500 text-sm mb-3">{result?.totalScore} / {result?.maxScore} 점</div>
            <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${result?.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {result?.passed ? '합격' : '불합격'}
            </span>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-4">문항별 결과</h2>
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const a = result?.answers[q.id];
            return (
              <div key={q.id} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${a?.isCorrect ? 'border-green-500' : 'border-red-400'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 w-6 h-6 text-xs font-bold rounded-full flex items-center justify-center ${a?.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{idx + 1}</span>
                  <p className="text-gray-900 font-medium text-sm leading-relaxed">{q.content}</p>
                </div>
                <div className="ml-9 space-y-1 text-sm">
                  <p><span className="text-gray-400">내 답:</span> <span className={a?.isCorrect ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{a?.given || '(미응답)'}</span></p>
                  {!a?.isCorrect && <p><span className="text-gray-400">정답:</span> <span className="text-gray-700 font-medium">{q.answer}</span></p>}
                </div>
              </div>
            );
          })}
        </div>

        {result && result.editHistory.length > 0 && (
          <div className="mt-6 bg-yellow-50 rounded-2xl p-4">
            <h3 className="font-bold text-yellow-800 mb-3 text-sm">수정 이력</h3>
            {result.editHistory.map((h, i) => (
              <div key={i} className="text-xs text-yellow-700 border-t border-yellow-200 pt-2 mt-2">
                <p>{new Date(h.editedAt).toLocaleString('ko-KR')} · {h.editedBy}</p>
                <p className="mt-1">사유: {h.reason}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
