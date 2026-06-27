'use client';

import { useState, useEffect } from 'react';
import { getResults, getExams, getQuestions, getParts, getStaffList, updateResult, deleteResult, updateAbsentReason } from '@/lib/firestore';
import { downloadCsv } from '@/lib/exportCsv';
import type { Exam, Result, Question, Part, EditHistory, Staff } from '@/lib/types';

export default function AdminResults() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  // 정답/오답 override: true=정답처리, false=오답처리, undefined=원래값 유지
  const [correctOverrides, setCorrectOverrides] = useState<Record<string, boolean>>({});
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // 미응시 사유 입력 상태: staffId → reason 텍스트
  const [absentReasonDraft, setAbsentReasonDraft] = useState<Record<string, string>>({});
  const [savingAbsent, setSavingAbsent] = useState<Record<string, boolean>>({});

  async function reload() {
    const [e, r, p, s] = await Promise.all([getExams(), getResults(), getParts(), getStaffList()]);
    setExams(e);
    setResults(r);
    setParts(p);
    setAllStaff(s);
  }

  useEffect(() => { reload().then(() => setLoading(false)); }, []);

  const filteredResults = results.filter(r => !selectedExamId || r.examId === selectedExamId);

  async function openResult(result: Result) {
    setSelectedResult(result);
    const qs = await getQuestions(result.examId);
    setQuestions(qs);
    setEditMode(false);
    setCorrectOverrides({});
  }

  function getEffectiveIsCorrect(qId: string): boolean {
    if (correctOverrides[qId] !== undefined) return correctOverrides[qId];
    return selectedResult?.answers[qId]?.isCorrect ?? false;
  }

  async function handleSaveEdit() {
    if (!selectedResult || !editReason.trim()) {
      setMsg('수정 사유를 입력해주세요.'); return;
    }
    // 변경된 항목이 있는지 확인
    const changedIds = Object.keys(correctOverrides).filter(
      qId => correctOverrides[qId] !== selectedResult.answers[qId]?.isCorrect
    );
    if (changedIds.length === 0) {
      setMsg('변경된 항목이 없습니다.'); return;
    }
    setSaving(true);

    const newAnswers = { ...selectedResult.answers };
    const history: EditHistory[] = [...selectedResult.editHistory];

    let totalScore = 0;
    let maxScore = 0;

    for (const q of questions) {
      const before = newAnswers[q.id] ?? { given: '', isCorrect: false, score: 0 };
      const isCorrect = correctOverrides[q.id] !== undefined ? correctOverrides[q.id] : before.isCorrect;
      const score = isCorrect ? q.score : 0;

      if (correctOverrides[q.id] !== undefined && correctOverrides[q.id] !== before.isCorrect) {
        history.push({
          questionId: q.id,
          before,
          after: { given: before.given, isCorrect, score },
          reason: editReason,
          editedBy: '관리자',
          editedAt: new Date().toISOString(),
        });
      }

      newAnswers[q.id] = { given: before.given, isCorrect, score };
      totalScore += score;
      maxScore += q.score;
    }

    const updated: Partial<Result> = {
      answers: newAnswers,
      totalScore,
      maxScore,
      passed: totalScore >= maxScore * 0.6,
      editHistory: history,
    };

    await updateResult(selectedResult.id, updated);
    await reload();
    setSelectedResult({ ...selectedResult, ...updated } as Result);
    setEditMode(false);
    setCorrectOverrides({});
    setEditReason('');
    setSaving(false);
    setMsg('수정되었습니다.');
    setTimeout(() => setMsg(''), 2000);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  if (selectedResult) {
    // 편집 모드에서 미리보기 점수 계산
    const previewScore = editMode
      ? questions.reduce((sum, q) => sum + (getEffectiveIsCorrect(q.id) ? q.score : 0), 0)
      : selectedResult.totalScore;

    return (
      <div className="p-8">
        <button onClick={() => setSelectedResult(null)} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 text-sm">← 목록으로</button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{selectedResult.staffName} · {selectedResult.staffEmployeeId}</h1>
            <p className="text-gray-500 text-sm">{selectedResult.examTitle} · {parts.find(p => p.id === selectedResult.partId)?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold text-blue-600">
              {editMode ? (
                <span>{previewScore}<span className="text-base text-gray-400">/{selectedResult.maxScore}점 (적용 후)</span></span>
              ) : (
                <span>{selectedResult.totalScore}/{selectedResult.maxScore}점</span>
              )}
            </div>
            {!editMode && (
              <button onClick={() => {
                setCorrectOverrides({});
                setEditMode(true);
              }} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                정답/오답 수정
              </button>
            )}
          </div>
        </div>

        {msg && <div className="mb-4 bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm">{msg}</div>}

        {editMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <p className="text-amber-800 font-medium text-sm mb-2">⚠️ 수정 모드 — 각 문항의 정답/오답 처리를 변경하면 점수에 즉시 반영됩니다.</p>
            <div className="flex gap-2">
              <input value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="수정 사유를 입력하세요 (필수)"
                className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <button onClick={handleSaveEdit} disabled={saving} className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {saving ? '저장 중...' : '수정 저장'}
              </button>
              <button onClick={() => { setEditMode(false); setCorrectOverrides({}); }} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">취소</button>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {questions.map((q, idx) => {
            const a = selectedResult.answers[q.id];
            const effectiveIsCorrect = getEffectiveIsCorrect(q.id);
            const isOverridden = correctOverrides[q.id] !== undefined;

            return (
              <div key={q.id} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${effectiveIsCorrect ? 'border-green-400' : 'border-red-400'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-6 h-6 text-xs font-bold rounded-full flex items-center justify-center ${effectiveIsCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{idx + 1}</span>
                    <p className="text-gray-900 font-medium text-sm">{q.content}</p>
                  </div>
                  {editMode && (
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {isOverridden && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">변경됨</span>
                      )}
                      <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        <button
                          onClick={() => setCorrectOverrides(prev => ({ ...prev, [q.id]: true }))}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${effectiveIsCorrect ? 'bg-green-500 text-white' : 'bg-white text-gray-500 hover:bg-green-50'}`}
                        >
                          정답
                        </button>
                        <button
                          onClick={() => setCorrectOverrides(prev => ({ ...prev, [q.id]: false }))}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${!effectiveIsCorrect ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-red-50'}`}
                        >
                          오답
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="ml-9 space-y-1 text-sm">
                  <div>
                    <span className="text-gray-400">제출 답안: </span>
                    <span className={`font-medium ${effectiveIsCorrect ? 'text-green-600' : 'text-red-500'}`}>{a?.given || '(미응답)'}</span>
                    <span className="ml-2 text-gray-400 text-xs">({effectiveIsCorrect ? `+${q.score}점` : '0점'})</span>
                  </div>
                  <div>
                    <span className="text-gray-400">정답: </span>
                    <span className="text-gray-700">{q.answer}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedResult.editHistory.length > 0 && (
          <div className="bg-yellow-50 rounded-2xl p-5">
            <h3 className="font-bold text-yellow-800 mb-3">수정 이력</h3>
            <div className="space-y-3">
              {selectedResult.editHistory.map((h, i) => {
                const q = questions.find(q => q.id === h.questionId);
                return (
                  <div key={i} className="bg-white rounded-xl p-4 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-700">{q ? `Q${questions.indexOf(q) + 1}. ${q.content.slice(0, 40)}...` : '(문항)'}</span>
                      <span className="text-gray-400 text-xs">{new Date(h.editedAt).toLocaleString('ko-KR')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className={`px-2 py-0.5 rounded font-medium ${h.before.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {h.before.isCorrect ? '정답' : '오답'} ({h.before.score}점)
                      </span>
                      <span>→</span>
                      <span className={`px-2 py-0.5 rounded font-medium ${h.after.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {h.after.isCorrect ? '정답' : '오답'} ({h.after.score}점)
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">사유: {h.reason} · {h.editedBy}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 선택된 시험
  const selectedExam = exams.find(e => e.id === selectedExamId) ?? null;

  // 미응시 인원: 선택 시험의 targetStaffIds 중 결과가 없는 인원
  const submittedStaffIds = new Set(filteredResults.map(r => r.staffId));
  const absentStaff: Staff[] = selectedExam
    ? (selectedExam.targetStaffIds ?? [])
        .map(id => allStaff.find(s => s.id === id))
        .filter((s): s is Staff => !!s && !submittedStaffIds.has(s.id))
    : [];

  async function handleSaveAbsentReason(staffId: string) {
    if (!selectedExamId) return;
    const reason = absentReasonDraft[staffId] ?? '';
    setSavingAbsent(p => ({ ...p, [staffId]: true }));
    await updateAbsentReason(selectedExamId, staffId, reason);
    setExams(prev => prev.map(e =>
      e.id === selectedExamId
        ? { ...e, absentReasons: { ...(e.absentReasons ?? {}), [staffId]: reason } }
        : e
    ));
    setSavingAbsent(p => ({ ...p, [staffId]: false }));
  }

  async function handleDeleteResult(r: Result) {
    if (!confirm(`${r.staffName}의 "${r.examTitle}" 결과를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    await deleteResult(r.id);
    await reload();
  }

  function handleExportExcel() {
    const headers = ['이름', '사번', '파트', '시험', '점수', '만점', '합격여부', '응시일시', '수정횟수'];
    const rows = filteredResults.map(r => [
      r.staffName,
      r.staffEmployeeId,
      parts.find(p => p.id === r.partId)?.name ?? '-',
      r.examTitle,
      r.totalScore,
      r.maxScore,
      r.passed ? '합격' : '불합격',
      new Date(r.submittedAt).toLocaleString('ko-KR'),
      r.editHistory.length,
    ]);
    const examName = selectedExam ? selectedExam.title.replace(/[\\/:*?"<>|]/g, '_') : '전체';
    downloadCsv(`결과관리_${examName}_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">결과 관리</h1>
        <div className="flex items-center gap-2">
          <select value={selectedExamId} onChange={e => {
            setSelectedExamId(e.target.value);
            setAbsentReasonDraft({});
          }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">전체 시험</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <button onClick={handleExportExcel} disabled={filteredResults.length === 0}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 응시 완료 결과 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
        {selectedExam && (
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">응시 완료</h2>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{filteredResults.length}명</span>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">이름</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">파트</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">시험</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">점수</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">수정</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredResults.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{r.staffName}</td>
                <td className="px-5 py-3 text-gray-500">{parts.find(p => p.id === r.partId)?.name ?? '-'}</td>
                <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{r.examTitle}</td>
                <td className="px-5 py-3 font-medium">{r.totalScore}/{r.maxScore}</td>
                <td className="px-5 py-3">
                  {r.editHistory.length > 0 && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{r.editHistory.length}회 수정</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => openResult(r)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">상세 보기</button>
                    <button onClick={() => handleDeleteResult(r)} className="text-red-500 hover:text-red-700 text-xs">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredResults.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-10">결과가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 미응시 인원 — 특정 시험 선택 시 항상 표시 (시험 전후 모두) */}
      {selectedExam && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">미응시 인원</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{absentStaff.length}명</span>
            {(selectedExam.targetStaffIds ?? []).length === 0 && (
              <span className="text-xs text-gray-400 ml-1">— 시험 관리에서 응시 대상 인원을 설정하세요</span>
            )}
          </div>
          {absentStaff.length === 0 && (selectedExam.targetStaffIds ?? []).length > 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">전원 응시 완료</p>
          ) : absentStaff.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">응시 대상 인원이 설정되지 않았습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">이름</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">파트</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">미응시 사유</th>
                  <th className="px-5 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {absentStaff.map(s => {
                  const savedReason = selectedExam.absentReasons?.[s.id] ?? '';
                  const draft = absentReasonDraft[s.id] !== undefined ? absentReasonDraft[s.id] : savedReason;
                  const isDirty = draft !== savedReason;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium">{s.name}</td>
                      <td className="px-5 py-3 text-gray-500">{parts.find(p => p.id === s.partId)?.name ?? '-'}</td>
                      <td className="px-5 py-3">
                        <input
                          value={draft}
                          onChange={e => setAbsentReasonDraft(p => ({ ...p, [s.id]: e.target.value }))}
                          placeholder="미응시 사유를 입력하세요"
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleSaveAbsentReason(s.id)}
                          disabled={!isDirty || savingAbsent[s.id]}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300"
                        >
                          {savingAbsent[s.id] ? '저장 중' : '저장'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
