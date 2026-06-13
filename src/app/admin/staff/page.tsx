'use client';

import { useState, useEffect } from 'react';
import { getParts, getStaffList, addPart, updatePart, deletePart, addStaff, updateStaff, toggleStaffActive } from '@/lib/firestore';
import type { Part, Staff } from '@/lib/types';

export default function AdminStaff() {
  const [parts, setParts] = useState<Part[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [activeTab, setActiveTab] = useState<'staff' | 'parts'>('staff');
  const [loading, setLoading] = useState(true);

  const [partName, setPartName] = useState('');
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  const [staffForm, setStaffForm] = useState({ name: '', employeeId: '', partId: '' });
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [filterPartId, setFilterPartId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [msg, setMsg] = useState('');

  async function reload() {
    const [p, s] = await Promise.all([getParts(), getStaffList()]);
    setParts(p);
    setStaffList(s);
  }

  useEffect(() => { reload().then(() => setLoading(false)); }, []);

  async function handleSavePart() {
    if (!partName.trim()) return;
    if (editingPart) {
      await updatePart(editingPart.id, { name: partName });
    } else {
      await addPart({ name: partName, order: parts.length + 1 });
    }
    setPartName(''); setEditingPart(null);
    await reload();
    setMsg('파트가 저장되었습니다.');
    setTimeout(() => setMsg(''), 2000);
  }

  async function handleDeletePart(id: string) {
    if (!confirm('파트를 삭제하면 해당 파트 상담사 정보도 영향을 받습니다. 삭제할까요?')) return;
    await deletePart(id);
    await reload();
  }

  async function handleSaveStaff() {
    if (!staffForm.name || !staffForm.employeeId || !staffForm.partId) {
      setMsg('모든 항목을 입력해주세요.'); return;
    }
    if (editingStaff) {
      await updateStaff(editingStaff.id, staffForm);
    } else {
      await addStaff({ ...staffForm, createdAt: new Date().toISOString(), isActive: true });
    }
    setStaffForm({ name: '', employeeId: '', partId: '' });
    setEditingStaff(null);
    await reload();
    setMsg('저장되었습니다.');
    setTimeout(() => setMsg(''), 2000);
  }

  async function handleToggleActive(s: Staff) {
    const next = s.isActive === false ? true : false;
    const label = next ? '활성화' : '비활성화(퇴사처리)';
    if (!confirm(`${s.name} 상담사를 ${label}하시겠습니까?`)) return;
    await toggleStaffActive(s.id, next);
    await reload();
  }

  const isActive = (s: Staff) => s.isActive !== false;

  const filteredStaff = staffList
    .filter(s => {
      if (statusFilter === 'active') return isActive(s);
      if (statusFilter === 'inactive') return !isActive(s);
      return true;
    })
    .filter(s => !filterPartId || s.partId === filterPartId)
    .filter(s => !search || s.name.includes(search) || s.employeeId.includes(search));

  if (loading) return <div className="flex items-center justify-center h-full min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">인원 관리</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[{ key: 'staff', label: '상담사 관리' }, { key: 'parts', label: '파트 관리' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm">{msg}</div>}

      {activeTab === 'parts' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="font-semibold text-gray-800 mb-3">{editingPart ? '파트 수정' : '파트 추가'}</h2>
            <div className="flex gap-2">
              <input value={partName} onChange={e => setPartName(e.target.value)} placeholder="파트명"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleSavePart} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {editingPart ? '수정' : '추가'}
              </button>
              {editingPart && (
                <button onClick={() => { setEditingPart(null); setPartName(''); }} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">취소</button>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
            {parts.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <span className="font-medium text-gray-800">{p.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingPart(p); setPartName(p.name); }} className="text-blue-600 hover:text-blue-800 text-sm">수정</button>
                  <button onClick={() => handleDeletePart(p.id)} className="text-red-500 hover:text-red-700 text-sm">삭제</button>
                </div>
              </div>
            ))}
            {parts.length === 0 && <div className="text-center text-gray-400 py-8">등록된 파트가 없습니다.</div>}
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="grid grid-cols-2 gap-6">
          {/* 추가/수정 폼 */}
          <div>
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <h2 className="font-semibold text-gray-800 mb-3">{editingStaff ? '상담사 수정' : '상담사 추가'}</h2>
              <div className="space-y-3">
                <input value={staffForm.name} onChange={e => setStaffForm(p => ({ ...p, name: e.target.value }))} placeholder="이름"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input value={staffForm.employeeId} onChange={e => setStaffForm(p => ({ ...p, employeeId: e.target.value }))} placeholder="사번"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={staffForm.partId} onChange={e => setStaffForm(p => ({ ...p, partId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">파트 선택</option>
                  {parts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={handleSaveStaff} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">
                    {editingStaff ? '수정' : '추가'}
                  </button>
                  {editingStaff && (
                    <button onClick={() => { setEditingStaff(null); setStaffForm({ name: '', employeeId: '', partId: '' }); }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">취소</button>
                  )}
                </div>
              </div>
            </div>

            {/* 상태 통계 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-700 mb-3">인원 현황</p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-blue-600">{staffList.filter(isActive).length}</p>
                  <p className="text-gray-500 text-xs mt-0.5">재직</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-gray-500">{staffList.filter(s => !isActive(s)).length}</p>
                  <p className="text-gray-500 text-xs mt-0.5">비활성</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-gray-700">{staffList.length}</p>
                  <p className="text-gray-500 text-xs mt-0.5">전체</p>
                </div>
              </div>
            </div>
          </div>

          {/* 목록 */}
          <div>
            <div className="flex gap-2 mb-3 flex-wrap">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름/사번 검색"
                className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={filterPartId} onChange={e => setFilterPartId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">전체 파트</option>
                {parts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">재직 중</option>
                <option value="inactive">비활성</option>
                <option value="all">전체</option>
              </select>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">이름</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">사번</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">파트</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStaff.map(s => (
                    <tr key={s.id} className={`hover:bg-gray-50 ${!isActive(s) ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500">{s.employeeId}</td>
                      <td className="px-4 py-3 text-gray-500">{parts.find(p => p.id === s.partId)?.name ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive(s) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {isActive(s) ? '재직' : '비활성'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => { setEditingStaff(s); setStaffForm({ name: s.name, employeeId: s.employeeId, partId: s.partId }); }}
                            className="text-blue-600 hover:text-blue-800 text-xs">수정</button>
                          <button
                            onClick={() => handleToggleActive(s)}
                            className={`text-xs ${isActive(s) ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}>
                            {isActive(s) ? '비활성화' : '활성화'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStaff.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-8">해당하는 상담사가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
