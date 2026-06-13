'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getExams, updateExam, deleteExam } from '@/lib/firestore';
import type { Exam, ExamStatus } from '@/lib/types';

const statusLabel: Record<ExamStatus, string> = { draft: '준비중', active: '진행중', closed: '마감' };
const statusColor: Record<ExamStatus, string> = { draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700', closed: 'bg-blue-100 text-blue-700' };

export default function AdminExams() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const e = await getExams();
    setExams(e);
  }

  useEffect(() => { reload().then(() => setLoading(false)); }, []);

  async function handleStatusChange(id: string, status: ExamStatus) {
    await updateExam(id, { status });
    await reload();
  }

  async function handleDelete(id: string) {
    if (!confirm('시험을 삭제하시겠습니까? 관련 문제도 삭제됩니다.')) return;
    const { deleteQuestionsByExam } = await import('@/lib/firestore');
    await deleteQuestionsByExam(id);
    await deleteExam(id);
    await reload();
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">시험 관리</h1>
        <button onClick={() => router.push('/admin/exams/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          + 새 시험 등록
        </button>
      </div>

      <div className="space-y-3">
        {exams.map(exam => (
          <div key={exam.id} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[exam.status]}`}>
                    {statusLabel[exam.status]}
                  </span>
                  <span className="text-xs text-gray-400">{exam.type}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{exam.title}</h3>
                <div className="text-sm text-gray-500 mt-1">
                  {exam.questionCount}문제 · {exam.timeLimit}분 · {exam.startDate} ~ {exam.endDate}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={exam.status}
                  onChange={e => handleStatusChange(exam.id, e.target.value as ExamStatus)}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">준비중</option>
                  <option value="active">진행중</option>
                  <option value="closed">마감</option>
                </select>
                <button onClick={() => router.push(`/admin/exams/${exam.id}`)}
                  className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg">수정</button>
                <button onClick={() => router.push(`/admin/exams/${exam.id}/questions`)}
                  className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg">문항 관리</button>
                <button onClick={() => handleDelete(exam.id)}
                  className="text-sm text-red-500 hover:text-red-700 px-2 py-1.5">삭제</button>
              </div>
            </div>
          </div>
        ))}
        {exams.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
            등록된 시험이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
