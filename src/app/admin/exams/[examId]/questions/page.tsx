'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getExam, getQuestions, addQuestion, updateQuestion, deleteQuestion, updateExam } from '@/lib/firestore';
import { parseQuestionsText } from '@/lib/parseQuestions';
import type { Exam, Question, QuestionType } from '@/lib/types';

const typeLabel: Record<QuestionType, string> = { multiple: '객관식', short: '단답형', ox: 'O/X' };

export default function QuestionManage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'bulk'>('list');
  const [msg, setMsg] = useState('');

  // Single question form
  const [qForm, setQForm] = useState({ type: 'multiple' as QuestionType, content: '', options: ['', '', '', ''], answer: '', score: 1 });

  // Bulk upload
  const [bulkText, setBulkText] = useState('');

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);

  async function reload() {
    const [exam, qs] = await Promise.all([getExam(examId), getQuestions(examId)]);
    setExam(exam);
    setQuestions(qs);
  }

  useEffect(() => { reload().then(() => setLoading(false)); }, [examId]);

  async function handleSaveQuestion() {
    if (!qForm.content || !qForm.answer) { setMsg('문제와 정답을 입력해주세요.'); return; }
    const data = {
      examId,
      order: editingId ? questions.find(q => q.id === editingId)?.order ?? questions.length + 1 : questions.length + 1,
      type: qForm.type,
      content: qForm.content,
      options: qForm.type === 'multiple' ? qForm.options.filter(o => o.trim()) : undefined,
      answer: qForm.answer,
      score: qForm.score,
    };
    if (editingId) {
      await updateQuestion(editingId, data);
    } else {
      await addQuestion(data);
    }
    await updateExam(examId, { questionCount: questions.length + (editingId ? 0 : 1) });
    setQForm({ type: 'multiple', content: '', options: ['', '', '', ''], answer: '', score: 1 });
    setEditingId(null);
    await reload();
    setMsg('저장되었습니다.');
    setActiveTab('list');
    setTimeout(() => setMsg(''), 2000);
  }

  async function handleBulkUpload() {
    if (!bulkText.trim()) return;
    const parsed = parseQuestionsText(bulkText, examId);
    const startOrder = questions.length + 1;
    for (let i = 0; i < parsed.length; i++) {
      await addQuestion({ ...parsed[i], order: startOrder + i });
    }
    await updateExam(examId, { questionCount: questions.length + parsed.length });
    setBulkText('');
    await reload();
    setMsg(`${parsed.length}개 문제가 등록되었습니다.`);
    setActiveTab('list');
    setTimeout(() => setMsg(''), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;
    await deleteQuestion(id);
    await updateExam(examId, { questionCount: Math.max(0, questions.length - 1) });
    await reload();
  }

  function startEdit(q: Question) {
    setEditingId(q.id);
    setQForm({
      type: q.type,
      content: q.content,
      options: q.type === 'multiple' ? [...(q.options ?? []), '', '', '', ''].slice(0, 4) : ['', '', '', ''],
      answer: q.answer,
      score: q.score,
    });
    setActiveTab('add');
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/admin/exams')} className="text-gray-400 hover:text-gray-600 text-sm mb-1">← 시험 목록</button>
          <h1 className="text-2xl font-bold text-gray-900">{exam?.title} — 문항 관리</h1>
        </div>
        <div className="text-sm text-gray-500">총 {questions.length}문제</div>
      </div>

      {msg && <div className="mb-4 bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm">{msg}</div>}

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[{ key: 'list', label: '문항 목록' }, { key: 'add', label: editingId ? '문항 수정' : '문항 추가' }, { key: 'bulk', label: '일괄 등록' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 text-sm font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{typeLabel[q.type]}</span>
                    <span className="text-xs text-gray-400">{q.score}점</span>
                  </div>
                  <p className="text-gray-900 font-medium">{q.content}</p>
                  {q.type === 'multiple' && q.options && (
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className={`text-sm px-3 py-1 rounded-lg ${opt === q.answer ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500'}`}>
                          {['①', '②', '③', '④'][oi]} {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type !== 'multiple' && (
                    <div className="mt-2 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-lg inline-block">
                      정답: {q.answer}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(q)} className="text-blue-600 hover:text-blue-800 text-sm">수정</button>
                  <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-700 text-sm">삭제</button>
                </div>
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
              문항이 없습니다. 문항을 추가하거나 일괄 등록을 이용하세요.
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="max-w-xl bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">문제 유형</label>
            <select value={qForm.type} onChange={e => setQForm(p => ({ ...p, type: e.target.value as QuestionType, answer: '' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="multiple">객관식</option>
              <option value="short">단답형</option>
              <option value="ox">O/X</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">문제 내용</label>
            <textarea value={qForm.content} onChange={e => setQForm(p => ({ ...p, content: e.target.value }))} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {qForm.type === 'multiple' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">보기 (정답이 될 항목에 정답 입력)</label>
              {qForm.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-gray-500 w-5">{['①', '②', '③', '④'][i]}</span>
                  <input value={opt} onChange={e => { const o = [...qForm.options]; o[i] = e.target.value; setQForm(p => ({ ...p, options: o })); }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">정답 (보기 내용과 동일하게 입력)</label>
                <input value={qForm.answer} onChange={e => setQForm(p => ({ ...p, answer: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          {qForm.type === 'ox' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">정답</label>
              <div className="flex gap-3">
                {['O', 'X'].map(v => (
                  <label key={v} className={`flex-1 flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer font-bold text-lg ${qForm.answer === v ? (v === 'O' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-red-500 bg-red-50 text-red-600') : 'border-gray-200 text-gray-400'}`}>
                    <input type="radio" value={v} checked={qForm.answer === v} onChange={() => setQForm(p => ({ ...p, answer: v }))} className="sr-only" />{v}
                  </label>
                ))}
              </div>
            </div>
          )}
          {qForm.type === 'short' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">정답</label>
              <input value={qForm.answer} onChange={e => setQForm(p => ({ ...p, answer: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">배점</label>
            <input type="number" value={qForm.score} min={1} onChange={e => setQForm(p => ({ ...p, score: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {msg && <p className="text-red-500 text-sm">{msg}</p>}
          <div className="flex gap-3">
            <button onClick={handleSaveQuestion} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold">
              {editingId ? '수정' : '추가'}
            </button>
            {editingId && (
              <button onClick={() => { setEditingId(null); setQForm({ type: 'multiple', content: '', options: ['', '', '', ''], answer: '', score: 1 }); setActiveTab('list'); }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-3 rounded-lg">취소</button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="max-w-2xl">
          <div className="bg-blue-50 rounded-xl p-4 mb-4 text-sm text-blue-700">
            <p className="font-semibold mb-2">📌 텍스트 형식 안내</p>
            <pre className="font-mono text-xs bg-white rounded-lg p-3 whitespace-pre-wrap">{`1. 화물 운송장의 필수 기재 항목이 아닌 것은?
① 발송인 이름
② 수취인 주소
③ 운전자 면허번호
④ 화물 중량
정답: ③ 운전자 면허번호

2. 배송 완료 처리 시 필수 확인 사항은?
정답: 수취인 서명

3. 화물 파손 시 즉시 해야 할 일은?
정답: 현장 사진 촬영 후 관리자에게 보고

4. 해당 설명이 맞으면 O, 틀리면 X를 선택하시오. 화물 분실 시 고객에게 즉시 연락한다.
정답: O`}</pre>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">문제 텍스트 붙여넣기</label>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={16}
              placeholder="위 형식에 맞게 문제를 붙여넣으세요..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
            />
            <button onClick={handleBulkUpload} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold">
              문제 일괄 등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
