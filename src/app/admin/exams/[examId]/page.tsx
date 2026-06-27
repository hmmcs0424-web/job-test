'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getExam, updateExam, getParts, getStaffList } from '@/lib/firestore';
import type { Part, Exam, Staff } from '@/lib/types';

const FIXED_PARTS = [
  { id: 'all', name: '전체' },
  { id: 'newcomer', name: '신입' },
  { id: 'manager', name: '관리자' },
  { id: 'call-support', name: '콜지원파트' },
  { id: 'complaint', name: '민원관리파트' },
];

export default function EditExam() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  const [parts, setParts] = useState<Part[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState({
    title: '', type: '', targetParts: [] as string[],
    targetStaffIds: [] as string[],
    timeLimit: 30, startDate: '', endDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffTab, setStaffTab] = useState<string>(''); // 파트별 탭

  const isActive = (s: Staff) => s.isActive !== false;

  useEffect(() => {
    Promise.all([getExam(examId), getParts(), getStaffList()]).then(([exam, parts, staff]) => {
      if (exam) {
        setForm({
          title: exam.title,
          type: exam.type,
          targetParts: exam.targetParts,
          targetStaffIds: exam.targetStaffIds ?? [],
          timeLimit: exam.timeLimit,
          startDate: exam.startDate,
          endDate: exam.endDate,
        });
      }
      setParts(parts);
      setAllStaff(staff.filter(isActive));
      setLoading(false);
    });
  }, [examId]);

  function togglePart(id: string) {
    setForm(p => ({ ...p, targetParts: p.targetParts.includes(id) ? p.targetParts.filter(x => x !== id) : [...p.targetParts, id] }));
  }

  function toggleStaff(id: string) {
    setForm(p => ({
      ...p,
      targetStaffIds: p.targetStaffIds.includes(id)
        ? p.targetStaffIds.filter(x => x !== id)
        : [...p.targetStaffIds, id],
    }));
  }

  function selectAllInPart(partId: string) {
    const ids = allStaff.filter(s => s.partId === partId).map(s => s.id);
    setForm(p => {
      const existing = new Set(p.targetStaffIds);
      const allSelected = ids.every(id => existing.has(id));
      if (allSelected) {
        // 이미 전체 선택이면 해제
        return { ...p, targetStaffIds: p.targetStaffIds.filter(id => !ids.includes(id)) };
      } else {
        const merged = Array.from(new Set([...p.targetStaffIds, ...ids]));
        return { ...p, targetStaffIds: merged };
      }
    });
  }

  function selectAll() {
    const allIds = allStaff.map(s => s.id);
    setForm(p => {
      const allSelected = allIds.every(id => p.targetStaffIds.includes(id));
      return { ...p, targetStaffIds: allSelected ? [] : allIds };
    });
  }

  async function handleSave() {
    setSaving(true);
    await updateExam(examId, {
      title: form.title,
      type: form.type,
      targetParts: form.targetParts,
      targetStaffIds: form.targetStaffIds,
      timeLimit: form.timeLimit,
      startDate: form.startDate,
      endDate: form.endDate,
    });
    router.push('/admin/exams');
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  const allParts: { id: string; name: string }[] = [
    ...FIXED_PARTS,
    ...parts.filter(p => !FIXED_PARTS.find(f => f.id === p.id)),
  ];

  // 파트별 staff 그룹
  const staffByPart = parts.map(p => ({
    part: p,
    staff: allStaff.filter(s => s.partId === p.id),
  })).filter(g => g.staff.length > 0);

  const selectedCount = form.targetStaffIds.length;
  const totalActiveStaff = allStaff.length;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.push('/admin/exams')} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 text-sm">← 돌아가기</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">시험 수정</h1>

      <div className="space-y-5">
        {/* 기본 정보 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">기본 정보</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시험 제목</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시험 유형</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>신입 직무테스트</option><option>월별 직무테스트</option><option>분기별 평가</option><option>기타</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
              <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
              <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제한 시간 (분)</label>
            <input type="number" value={form.timeLimit} onChange={e => setForm(p => ({ ...p, timeLimit: Number(e.target.value) }))} min={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* 응시 대상 파트 */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-3">응시 대상 파트</h2>
          <div className="flex flex-wrap gap-2">
            {allParts.map(p => (
              <label key={p.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${form.targetParts.includes(p.id) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:border-blue-400'}`}>
                <input type="checkbox" checked={form.targetParts.includes(p.id)} onChange={() => togglePart(p.id)} className="sr-only" />{p.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">파트 분류용 태그입니다. 아래에서 실제 응시 대상 인원을 선택하세요.</p>
        </div>

        {/* 응시 대상 인원 선택 */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800">응시 대상 인원</h2>
              <p className="text-xs text-gray-400 mt-0.5">선택된 인원: <span className="font-bold text-blue-600">{selectedCount}명</span> / 전체 {totalActiveStaff}명</p>
            </div>
            <button
              onClick={selectAll}
              className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${selectedCount === totalActiveStaff && totalActiveStaff > 0 ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
              {selectedCount === totalActiveStaff && totalActiveStaff > 0 ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {staffByPart.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">인원관리에서 상담사를 등록하면 여기에 표시됩니다.</p>
          ) : (
            <div className="space-y-4">
              {/* 파트 탭 */}
              <div className="flex gap-1 flex-wrap border-b border-gray-100 pb-3">
                <button
                  onClick={() => setStaffTab('')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${staffTab === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  전체 보기
                </button>
                {staffByPart.map(g => {
                  const partSelected = g.staff.filter(s => form.targetStaffIds.includes(s.id)).length;
                  return (
                    <button key={g.part.id}
                      onClick={() => setStaffTab(g.part.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${staffTab === g.part.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {g.part.name} ({partSelected}/{g.staff.length})
                    </button>
                  );
                })}
              </div>

              {/* 파트별 인원 */}
              {(staffTab ? staffByPart.filter(g => g.part.id === staffTab) : staffByPart).map(g => {
                const partIds = g.staff.map(s => s.id);
                const allPartSelected = partIds.every(id => form.targetStaffIds.includes(id));
                return (
                  <div key={g.part.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">{g.part.name}</span>
                      <button
                        onClick={() => selectAllInPart(g.part.id)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${allPartSelected ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-gray-300 text-gray-500 hover:border-blue-300'}`}>
                        {allPartSelected ? '파트 전체 해제' : '파트 전체 선택'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {g.staff.map(s => {
                        const checked = form.targetStaffIds.includes(s.id);
                        return (
                          <label key={s.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${checked ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-blue-300'}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleStaff(s.id)} className="sr-only" />
                            <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                              {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </span>
                            <div>
                              <p className="font-medium leading-tight">{s.name}</p>
                              <p className="text-xs text-gray-400">{s.employeeId}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 저장 버튼 */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg font-semibold">
            {saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={() => router.push(`/admin/exams/${examId}/questions`)}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold">
            문항 관리 →
          </button>
        </div>
      </div>
    </div>
  );
}
