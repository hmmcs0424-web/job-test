'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getExam, getQuestions, getResultByExamAndStaff } from '@/lib/firestore';
import { getStaffSession } from '@/lib/session';
import type { Exam, Question, Result } from '@/lib/types';

/* ── 라이트박스 ── */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-85 flex items-center justify-center p-4 cursor-zoom-out" onClick={onClose}>
      <img src={src} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-80 rounded-full w-9 h-9 flex items-center justify-center text-lg">✕</button>
    </div>
  );
}

function ZoomableImage({ src, className = '' }: { src: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img src={src} alt="" className={`cursor-zoom-in ${className}`} onClick={() => setOpen(true)} />
      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

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
        setExam(exam); setQuestions(qs); setResult(result); setLoading(false);
      });
  }, [examId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const pct = result && result.maxScore > 0 ? Math.round((result.totalScore / result.maxScore) * 100) : 0;
  const correct = questions.filter(q => result?.answers[q.id]?.isCorrect).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/exam/list')} className="text-gray-400 hover:text-gray-600 text-sm">← 목록으로</button>
          <h1 className="font-bold text-gray-900">{exam?.title}</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* 점수 카드 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="text-center">
            <div className={`text-6xl font-black mb-2 ${pct >= 60 ? 'text-blue-600' : 'text-red-500'}`}>{pct}<span className="text-3xl">점</span></div>
            <div className="text-gray-500 text-sm mb-3">{result?.totalScore} / {result?.maxScore} 점 &nbsp;·&nbsp; {correct}/{questions.length} 정답</div>
            <span className={`inline-block px-5 py-1.5 rounded-full text-sm font-bold ${result?.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {result?.passed ? '✓ 합격' : '✗ 불합격'}
            </span>
          </div>
        </div>

        {/* 문항별 결과 */}
        <h2 className="text-lg font-bold text-gray-900 mb-4">문항별 결과</h2>
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const a = result?.answers[q.id];
            return (
              <div key={q.id} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${a?.isCorrect ? 'border-green-400' : 'border-red-400'}`}>
                {/* 문제 */}
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 w-6 h-6 text-xs font-bold rounded-full flex items-center justify-center ${a?.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{idx + 1}</span>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium text-sm leading-relaxed">{q.content}</p>
                    {q.imageUrl && (
                      <div className="mt-2">
                        <ZoomableImage src={q.imageUrl} className="max-h-40 rounded-lg border border-gray-200 shadow-sm" />
                        <p className="text-xs text-gray-400 mt-1">클릭하면 크게 볼 수 있습니다</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 정오 */}
                <div className="ml-9 space-y-1 text-sm">
                  <p>
                    <span className="text-gray-400">내 답: </span>
                    <span className={a?.isCorrect ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>{a?.given || '(미응답)'}</span>
                    {a?.isCorrect && <span className="ml-1 text-green-500">✓</span>}
                  </p>
                  {!a?.isCorrect && (
                    <p><span className="text-gray-400">정답: </span><span className="text-gray-800 font-semibold">{q.answer}</span></p>
                  )}
                </div>

                {/* 풀이 */}
                {q.explanation && (
                  <div className="ml-9 mt-3 bg-amber-50 rounded-xl p-3 border border-amber-100 space-y-2">
                    <p className="text-xs font-bold text-amber-700">💡 풀이</p>
                    {q.explanation.text && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{q.explanation.text}</p>
                    )}
                    {q.explanation.imageUrl && (
                      <div>
                        <ZoomableImage src={q.explanation.imageUrl} className="max-h-48 rounded-lg border border-amber-200" />
                        <p className="text-xs text-amber-600 mt-1">클릭하면 크게 볼 수 있습니다</p>
                      </div>
                    )}
                    {q.explanation.links && q.explanation.links.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {q.explanation.links.map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline">
                            🔗 {l.label || l.url}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 수정 이력 */}
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
