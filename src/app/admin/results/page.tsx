'use client';

import { useState, useEffect } from 'react';
import { getResults, getExams, getQuestions, getParts, updateResult } from '@/lib/firestore';
import type { Exam, Result, Question, Part, EditHistory, AnswerRecord } from '@/lib/types';

export default function AdminResults() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editAnswers, setEditAnswers] = useState<Record<string, string>>({});
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function reload() {
    const [e, r, p] = await Promise.all([getExams(), getResults(), getParts()]);
    setExams(e);
    setResults(r);
    setParts(p);
  }

  useEffect(() => { reload().then(() => setLoading(false)); }, []);

  const filteredResults = results.filter(r => !selectedExamId || r.examId === selectedExamId);

  async function openResult(result: Result) {
    setSelectedResult(result);
    const qs = await getQuestions(result.examId);
    setQuestions(qs);
    setEditMode(false);
  }

  async function handleSaveEdit() {
    if (!selectedResult || !editReason.trim()) {
      setMsg('수정 사유를 입력해주세요.'); return;
    }
    setSaving(true);

    const newAnswers = { ...selectedResult.answers };
    const history: EditHistory[] = [...selectedResult.editHistory];

    let totalScore = 0;
    let maxScore = 0;

    for (const q of questions) {
      const before = newAnswers[q.id];
      const newGiven = editAnswers[q.id] ?? before?.given ?? '';
      const isCorrect = newGiven.trim() === q.answer.trim();
      const score = isCorrect ? q.score : 0;

      if (newGiven !== before?.given) {
        history.push({
          questionId: q.id,
          before: before ?? { given: '', isCorrect: false, score: 0 },
          after: { given: newGiven, isCorrect, score },
          reason: editReason,
          editedBy: '관리자',
          editedAt: new Date().toISOString(),
        });
      }

      newAnswers[q.id] = { given: newGiven, isCorrect, score };
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
    setEditReason('');
    setSaving(false);
    setMsg('수정되었습니다.');
    setTimeout(() => setMsg(''), 2000);
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  if (selectedResult) {
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
              {selectedResult.totalScore}/{selectedResult.maxScore}점
            </div>
            {!editMode && (
              <button onClick={() => {
                const init: Record<string, string> = {};
                questions.forEach(q => { init[q.id] = selectedResult.answers[q.id]?.given ?? ''; });
                setEditAnswers(init);
                setEditMode(true);
              }} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                답안 수정
              </button>
            )}
          </div>
        </div>

        {msg && <div className="mb-4 bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm">{msg}</div>}

        {editMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <p className="text-amber-800 font-medium text-sm mb-2">⚠️ 수정 모드 — 변경된 답안은 자동으로 채점됩니다.</p>
            <div className="flex gap-2">
              <input value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="수정 사유를 입력하세요 (필수)"
                className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <button onClick={handleSaveEdit} disabled={saving} className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {saving ? '저장 중...' : '수정 저장'}
              </button>
              <button onClick={() => setEditMode(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">취소</button>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {questions.map((q, idx) => {
            const a = selectedResult.answers[q.id];
            return (
              <div key={q.id} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${a?.isCorrect ? 'border-green-400' : 'border-red-400'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 w-6 h-6 text-xs font-bold rounded-full flex items-center justify-center ${a?.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{idx + 1}</span>
                  <p className="text-gray-900 font-medium text-sm">{q.content}</p>
                </div>
                <div className="ml-9 space-y-2">
                  {editMode ? (
                    q.type === 'multiple' && q.options ? (
                      <div className="space-y-1">
                        {q.options.map((opt, oi) => (
                          <label key={oi} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${editAnswers[q.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                            <input type="radio" name={`edit-${q.id}`} value={opt} checked={editAnswers[q.id] === opt}
                              onChange={() => setEditAnswers(p => ({ ...p, [q.id]: opt }))} className="text-blue-600" />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : q.type === 'ox' ? (
                      <div className="flex gap-2">
                        {['O', 'X'].map(v => (
                          <label key={v} className={`flex-1 flex items-center justify-center p-2 rounded-lg border cursor-pointer font-bold ${editAnswers[q.id] === v ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'}`}>
                            <input type="radio" value={v} checked={editAnswers[q.id] === v} onChange={() => setEditAnswers(p => ({ ...p, [q.id]: v }))} className="sr-only" />{v}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input value={editAnswers[q.id] ?? ''} onChange={e => setEditAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    )
                  ) : (
                    <div className="text-sm space-y-1">
                      <span className="text-gray-400">답안: </span>
                      <span className={a?.isCorrect ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{a?.given || '(미응답)'}</span>
                      {!a?.isCorrect && <> · <span className="text-gray-400">정답: </span><span className="text-gray-700">{q.answer}</span></>}
                    </div>
                  )}
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
                      <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded">{h.before.given || '(미응답)'}</span>
                      <span>→</span>
                      <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded">{h.after.given}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">사유: {h.reason}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">결과 관리</h1>
        <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">전체 시험</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
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
                  <button onClick={() => openResult(r)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">상세 보기</button>
                </td>
              </tr>
            ))}
            {filteredResults.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-10">결과가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
