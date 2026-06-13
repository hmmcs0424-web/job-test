'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getNonDraftExams, findStaff, getParts, getAdminConfig } from '@/lib/firestore';
import { saveStaffSession } from '@/lib/session';
import type { Exam, Part } from '@/lib/types';

export default function ExamLogin() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    Promise.all([getNonDraftExams(), getParts(), getAdminConfig()]).then(([exs, pts, cfg]) => {
      setExams(exs);
      setParts(pts);
      if (cfg?.defaultExamId && exs.some((e: Exam) => e.id === cfg.defaultExamId)) {
        setSelectedExamId(cfg.defaultExamId);
      }
      setLoading(false);
    });
  }, []);

  async function handleLogin() {
    if (!selectedExamId) { setError('시험을 선택해주세요.'); return; }
    if (!name || !employeeId) { setError('이름과 사번을 모두 입력해주세요.'); return; }
    setLoggingIn(true);
    const staff = await findStaff(name.trim(), employeeId.trim());
    if (!staff) {
      setError('이름과 사번이 일치하는 상담사를 찾을 수 없습니다.');
      setLoggingIn(false);
      return;
    }
    const part = parts.find(p => p.id === staff.partId);
    saveStaffSession({ ...staff, partName: part?.name });
    router.push(`/exam/${selectedExamId}/start`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 text-sm">
          ← 돌아가기
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">상담사 로그인</h2>
        <p className="text-gray-500 text-sm mb-6">시험을 선택하고 이름과 사번을 입력해주세요</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시험 선택</label>
            <select
              value={selectedExamId}
              onChange={e => { setSelectedExamId(e.target.value); setError(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">시험을 선택하세요</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
            {exams.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">현재 진행 중인 시험이 없습니다.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLogin(); } }}
              placeholder="이름을 입력하세요"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사번</label>
            <input
              type="text"
              value={employeeId}
              onChange={e => { setEmployeeId(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLogin(); } }}
              placeholder="사번을 입력하세요"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loggingIn}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg py-3 font-semibold transition-colors"
          >
            {loggingIn ? '확인 중...' : '로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}
