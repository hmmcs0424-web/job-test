'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStaffList, getParts } from '@/lib/firestore';
import { saveStaffSession } from '@/lib/session';
import type { Staff, Part } from '@/lib/types';

export default function ExamLogin() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [name, setName] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStaffList(), getParts()]).then(([staff, parts]) => {
      setStaffList(staff);
      setParts(parts);
      setLoading(false);
    });
  }, []);

  const filteredStaff = staffList.filter(s =>
    (!selectedPartId || s.partId === selectedPartId) &&
    (!name || s.name.includes(name))
  );

  const matchedStaff = staffList.find(
    s => s.name === name && s.employeeId === selectedEmployeeId
  );

  function handleLogin() {
    if (!name || !selectedEmployeeId) {
      setError('이름과 사번을 모두 입력해주세요.');
      return;
    }
    if (!matchedStaff) {
      setError('이름과 사번이 일치하는 상담사를 찾을 수 없습니다.');
      return;
    }
    const part = parts.find(p => p.id === matchedStaff.partId);
    saveStaffSession({ ...matchedStaff, partName: part?.name });
    router.push('/exam/list');
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
        <p className="text-gray-500 text-sm mb-6">이름과 사번을 입력해주세요</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">파트 선택</label>
            <select
              value={selectedPartId}
              onChange={e => { setSelectedPartId(e.target.value); setName(''); setSelectedEmployeeId(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              {parts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setSelectedEmployeeId(''); setError(''); }}
              placeholder="이름을 입력하세요"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사번</label>
            <select
              value={selectedEmployeeId}
              onChange={e => { setSelectedEmployeeId(e.target.value); setError(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">사번 선택</option>
              {filteredStaff
                .filter(s => !name || s.name === name)
                .map(s => (
                  <option key={s.id} value={s.employeeId}>{s.employeeId}</option>
                ))}
            </select>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-semibold transition-colors"
          >
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}
