'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addExam, getParts } from '@/lib/firestore';
import type { Part } from '@/lib/types';

export default function NewExam() {
  const router = useRouter();
  const [parts, setParts] = useState<Part[]>([]);
  const [form, setForm] = useState({
    title: '',
    type: '신입 직무테스트',
    targetParts: [] as string[],
    timeLimit: 30,
    startDate: '',
    endDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { getParts().then(setParts); }, []);

  function togglePart(id: string) {
    setForm(p => ({
      ...p,
      targetParts: p.targetParts.includes(id)
        ? p.targetParts.filter(x => x !== id)
        : [...p.targetParts, id],
    }));
  }

  async function handleSave() {
    if (!form.title || !form.startDate || !form.endDate) {
      setError('필수 항목을 모두 입력해주세요.'); return;
    }
    setSaving(true);
    await addExam({
      ...form,
      targetStaffIds: [],
      status: 'draft',
      questionCount: 0,
      createdAt: new Date().toISOString(),
    });
    router.push('/admin/exams');
  }

  return (
    <div className="p-8 max-w-xl">
      <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 text-sm">← 돌아가기</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">새 시험 등록</h1>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">시험 제목 *</label>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="예) 2024년 6월 월별 직무테스트"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">시험 유형</label>
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>신입 직무테스트</option>
            <option>월별 직무테스트</option>
            <option>분기별 평가</option>
            <option>기타</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">응시 대상 파트</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', name: '전체' },
              { id: 'newcomer', name: '신입' },
              { id: 'manager', name: '관리자' },
              { id: 'call-support', name: '콜지원파트' },
              { id: 'complaint', name: '민원관리파트' },
              ...parts.filter(p => !['all','newcomer','manager','call-support','complaint'].includes(p.id)),
            ].map(p => (
              <label key={p.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${form.targetParts.includes(p.id) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:border-blue-400'}`}>
                <input type="checkbox" checked={form.targetParts.includes(p.id)} onChange={() => togglePart(p.id)} className="sr-only" />
                {p.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">여러 파트를 동시에 선택할 수 있습니다.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제한 시간 (분)</label>
          <input type="number" value={form.timeLimit} onChange={e => setForm(p => ({ ...p, timeLimit: Number(e.target.value) }))}
            min={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일 *</label>
            <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일 *</label>
            <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg font-semibold">
          {saving ? '저장 중...' : '시험 등록'}
        </button>
      </div>
    </div>
  );
}
