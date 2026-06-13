'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveExamsForPart, getResultByExamAndStaff } from '@/lib/firestore';
import { getStaffSession, clearStaffSession } from '@/lib/session';
import type { Exam } from '@/lib/types';

export default function ExamList() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [submittedExamIds, setSubmittedExamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const staff = getStaffSession();

  useEffect(() => {
    if (!staff) { router.push('/exam/login'); return; }

    getActiveExamsForPart(staff.partId).then(async exams => {
      setExams(exams);
      const submitted = await Promise.all(
        exams.map(e => getResultByExamAndStaff(e.id, staff.id))
      );
      const ids = new Set(submitted.flatMap((r, i) => r ? [exams[i].id] : []));
      setSubmittedExamIds(ids);
      setLoading(false);
    });
  }, []);

  function handleLogout() {
    clearStaffSession();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">직무테스트</h1>
            <p className="text-sm text-gray-500">{staff?.name} · {staff?.partName}</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-1.5">
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">응시 가능한 시험</h2>

        {exams.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm">
            현재 응시 가능한 시험이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {exams.map(exam => {
              const submitted = submittedExamIds.has(exam.id);
              return (
                <div key={exam.id} className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {exam.type}
                        </span>
                        {submitted && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            제출 완료
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg">{exam.title}</h3>
                      <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                        <p>문항 수: {exam.questionCount}문제</p>
                        <p>제한 시간: {exam.timeLimit}분</p>
                        <p>기간: {exam.startDate} ~ {exam.endDate}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {submitted ? (
                        <div className="text-center">
                          <div className="text-sm text-gray-400 mb-2">제출 완료</div>
                          {exam.status === 'closed' ? (
                            <button
                              onClick={() => router.push(`/exam/${exam.id}/result`)}
                              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
                            >
                              결과 보기
                            </button>
                          ) : (
                            <p className="text-xs text-gray-400">시험 마감 후 결과 공개</p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => router.push(`/exam/${exam.id}/start`)}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
                        >
                          시험 시작
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
