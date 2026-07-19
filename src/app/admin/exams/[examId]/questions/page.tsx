'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getExam, getQuestions, addQuestion, updateQuestion,
  deleteQuestion, updateExam,
} from '@/lib/firestore';
import { parseQuestionsText } from '@/lib/parseQuestions';
import { uploadQuestionImage } from '@/lib/uploadImage';
import { splitAnswer, joinAnswer, formatAnswerDisplay } from '@/lib/answer';
import type { Exam, Question, QuestionType, Explanation, ExplanationLink } from '@/lib/types';

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple: '객관식', short: '단답형', long: '장문형', ox: 'O/X',
};
const TYPE_COLORS: Record<QuestionType, string> = {
  multiple: 'bg-blue-100 text-blue-700',
  short: 'bg-emerald-100 text-emerald-700',
  long: 'bg-purple-100 text-purple-700',
  ox: 'bg-orange-100 text-orange-700',
};

/* ─────────────── 라이트박스 ─────────────── */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out" onClick={onClose}>
      <img src={src} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-lg">✕</button>
    </div>
  );
}
function ZoomImg({ src, className = '' }: { src: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <img src={src} alt="" className={`cursor-zoom-in ${className}`} onClick={() => setOpen(true)} />
      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ─────────────── 이미지 입력 ─────────────── */
function ImageInput({ examId, value, onChange, label = '이미지 첨부 (선택)' }: {
  examId: string; value: string; onChange: (v: string) => void; label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const processFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadQuestionImage(file, examId);
      onChange(url);
    } catch {
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    }
    setUploading(false);
  }, [examId, onChange]);

  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      if (!focused) return;
      const img = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (img) { e.preventDefault(); const f = img.getAsFile(); if (f) processFile(f); }
    };
    document.addEventListener('paste', h);
    return () => document.removeEventListener('paste', h);
  }, [focused, processFile]);

  if (value) return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <div className="relative inline-block group">
        <ZoomImg src={value} className="max-h-32 rounded-lg border border-gray-200 shadow-sm" />
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={() => fileRef.current?.click()} className="w-6 h-6 bg-white/90 border border-gray-200 rounded-full flex items-center justify-center text-xs shadow">✎</button>
          <button type="button" onClick={() => onChange('')} className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow">✕</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
    </div>
  );

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <div ref={boxRef} tabIndex={0}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onClick={() => boxRef.current?.focus()}
        className={`rounded-lg border-2 border-dashed p-3 text-center cursor-pointer outline-none transition-colors
          ${focused ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'}`}>
        {uploading
          ? <div className="flex items-center justify-center gap-2 text-blue-600 py-1"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" /><span className="text-xs">업로드 중...</span></div>
          : <>
            <p className="text-xs text-gray-400">{focused ? '👉 Ctrl+V 붙여넣기' : '클릭 후 Ctrl+V'}</p>
            <div className="flex justify-center gap-2 mt-2">
              <button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                className="text-xs bg-white border border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-md px-2 py-1 transition-colors">📁 파일</button>
              <button type="button" onClick={e => { e.stopPropagation(); setShowUrl(v => !v); }}
                className="text-xs bg-white border border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-600 rounded-md px-2 py-1 transition-colors">🔗 URL</button>
            </div>
            {showUrl && (
              <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
                <input type="url" value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && urlDraft.trim()) { onChange(urlDraft.trim()); setUrlDraft(''); setShowUrl(false); } }}
                  placeholder="https://..." className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button type="button" onClick={() => { if (urlDraft.trim()) { onChange(urlDraft.trim()); setUrlDraft(''); setShowUrl(false); } }}
                  className="bg-blue-600 text-white rounded-md px-2 py-1 text-xs hover:bg-blue-700">적용</button>
              </div>
            )}
          </>
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
    </div>
  );
}

/* ─────────────── 초기 폼 ─────────────── */
function emptyForm() {
  return {
    type: 'multiple' as QuestionType,
    content: '', imageUrl: '',
    options: ['', '', '', ''],
    answer: '', score: 1,
    expText: '', expImageUrl: '',
    expLinks: [] as ExplanationLink[],
  };
}

/* ═══════════════════════════════════════
   메인 페이지
═══════════════════════════════════════ */
export default function QuestionManage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'manage' | 'bulk'>('manage');

  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  // 드래그 상태
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  async function reload() {
    const [e, qs] = await Promise.all([getExam(examId), getQuestions(examId)]);
    setExam(e); setQuestions(qs);
  }
  useEffect(() => { reload().then(() => setLoading(false)); }, [examId]);

  /* ── 옵션 관리 ── */
  const setOpt = (i: number, v: string) => setForm(p => { const o = [...p.options]; o[i] = v; return { ...p, options: o }; });
  const addOpt = () => setForm(p => ({ ...p, options: [...p.options, ''] }));
  const delOpt = (i: number) => setForm(p => ({
    ...p, options: p.options.filter((_, idx) => idx !== i),
    answer: joinAnswer(splitAnswer(p.answer).filter(a => a !== p.options[i].trim())),
  }));
  const toggleAnswer = (opt: string) => setForm(p => {
    const current = splitAnswer(p.answer);
    const next = current.includes(opt) ? current.filter(a => a !== opt) : [...current, opt];
    return { ...p, answer: joinAnswer(next) };
  });

  /* ── 링크 관리 ── */
  const addLink = () => setForm(p => ({ ...p, expLinks: [...p.expLinks, { label: '', url: '' }] }));
  const delLink = (i: number) => setForm(p => ({ ...p, expLinks: p.expLinks.filter((_, idx) => idx !== i) }));
  const setLinkF = (i: number, f: 'label' | 'url', v: string) => setForm(p => {
    const links = [...p.expLinks]; links[i] = { ...links[i], [f]: v };
    return { ...p, expLinks: links };
  });

  /* ── 저장 ── */
  async function handleSave() {
    if (!form.content.trim()) { showToast('문제 내용을 입력해주세요.'); return; }
    if (!form.answer.trim()) { showToast('정답을 입력해주세요.'); return; }
    setSaving(true);

    const expLinks = form.expLinks.filter(l => l.url.trim());
    const explanation: Explanation | undefined =
      form.expText.trim() || form.expImageUrl || expLinks.length
        ? {
          ...(form.expText.trim() ? { text: form.expText.trim() } : {}),
          ...(form.expImageUrl ? { imageUrl: form.expImageUrl } : {}),
          ...(expLinks.length ? { links: expLinks } : {}),
        }
        : undefined;

    const data: Omit<Question, 'id'> = {
      examId,
      order: editId ? (questions.find(q => q.id === editId)?.order ?? questions.length + 1) : questions.length + 1,
      type: form.type,
      content: form.content.trim(),
      answer: form.answer.trim(),
      score: form.score,
      ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
      ...(form.type === 'multiple' ? { options: form.options.map(o => o.trim()).filter(Boolean) } : {}),
      ...(explanation ? { explanation } : {}),
    };

    if (editId) {
      await updateQuestion(editId, data);
      showToast('수정되었습니다.');
    } else {
      await addQuestion(data);
      await updateExam(examId, { questionCount: questions.length + 1 });
      showToast('문항이 추가되었습니다. 다음 문항을 입력하세요.');
    }

    await reload();
    // ★ 편집 완료 시에만 폼 초기화, 신규 추가 시에는 폼 유지 (editId 해제만)
    setEditId(null);
    setForm(emptyForm());
    setSaving(false);
  }

  /* ── 편집 시작 ── */
  function startEdit(q: Question) {
    setEditId(q.id);
    setForm({
      type: q.type, content: q.content, imageUrl: q.imageUrl ?? '',
      options: q.type === 'multiple'
        ? [...(q.options ?? []), '', '', '', ''].slice(0, Math.max(4, q.options?.length ?? 0))
        : ['', '', '', ''],
      answer: q.answer, score: q.score,
      expText: q.explanation?.text ?? '',
      expImageUrl: q.explanation?.imageUrl ?? '',
      expLinks: q.explanation?.links ? [...q.explanation.links] : [],
    });
    // 폼 상단으로 스크롤
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const formRef = useRef<HTMLDivElement>(null);

  /* ── 삭제 ── */
  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteQuestion(id);
    await updateExam(examId, { questionCount: Math.max(0, questions.length - 1) });
    if (editId === id) { setEditId(null); setForm(emptyForm()); }
    await reload();
  }

  /* ── 드래그 & 드롭 순서 변경 ── */
  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOver(idx); }
  async function handleDrop(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOver(null); return; }
    const reordered = [...questions];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = reordered.map((q, i) => ({ ...q, order: i + 1 }));
    setQuestions(updated);
    setDragIdx(null); setDragOver(null);
    await Promise.all(updated.map(q => updateQuestion(q.id, { order: q.order })));
    showToast('순서가 변경되었습니다.');
  }

  /* ── 일괄 등록 ── */
  async function handleBulk() {
    if (!bulkText.trim()) return;
    setBulkSaving(true);
    try {
      const parsed = parseQuestionsText(bulkText, examId);
      if (!parsed.length) { showToast('파싱된 문항이 없습니다. 형식을 확인하세요.'); setBulkSaving(false); return; }
      for (let i = 0; i < parsed.length; i++) {
        await addQuestion({ ...parsed[i], order: questions.length + i + 1 });
      }
      await updateExam(examId, { questionCount: questions.length + parsed.length });
      await reload();
      showToast(`${parsed.length}개 문항 등록 완료! 목록에서 확인하세요.`);
      setBulkText('');
      setView('manage'); // 등록 후 문항 관리 뷰로 이동
    } catch (err) {
      showToast('오류가 발생했습니다. 형식을 확인하세요.');
      console.error(err);
    }
    setBulkSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="p-6 h-full">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <button onClick={() => router.push('/admin/exams')} className="text-gray-400 hover:text-gray-600 text-sm mb-0.5 flex items-center gap-1">← 시험 목록</button>
          <h1 className="text-xl font-bold text-gray-900">{exam?.title} — 문항 관리</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">총 {questions.length}문제</span>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setView('manage')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${view === 'manage' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              문항 관리
            </button>
            <button onClick={() => setView('bulk')}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${view === 'bulk' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              일괄 등록
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2.5 text-sm font-medium">
          {toast}
        </div>
      )}

      {/* ════════════════════════════════════════
          문항 관리 뷰 — 좌: 목록 / 우: 폼
      ════════════════════════════════════════ */}
      {view === 'manage' && (
        <div className="flex gap-5 items-start">

          {/* ── 왼쪽: 문항 목록 (드래그 순서변경) ── */}
          <div className="w-96 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">문항 목록</span>
                <span className="text-xs text-gray-400">≡ 드래그로 순서 변경</span>
              </div>

              {questions.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  오른쪽에서 문항을 추가하세요
                </div>
              ) : (
                <div className="divide-y divide-gray-50 max-h-[calc(100vh-220px)] overflow-y-auto">
                  {questions.map((q, idx) => (
                    <div key={q.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
                      className={`flex items-start gap-2 px-3 py-3 transition-all cursor-default
                        ${dragOver === idx ? 'bg-blue-50 border-t-2 border-blue-400' : ''}
                        ${dragIdx === idx ? 'opacity-40' : ''}
                        ${editId === q.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>

                      {/* 드래그 핸들 */}
                      <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 pt-0.5 flex-shrink-0 select-none" title="드래그하여 순서 변경">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                          <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
                          <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
                          <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
                        </svg>
                      </div>

                      {/* 번호 */}
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${TYPE_COLORS[q.type]}`}>
                            {TYPE_LABELS[q.type]}
                          </span>
                          {q.imageUrl && <span className="text-xs text-gray-400">🖼</span>}
                          {q.explanation && <span className="text-xs text-amber-500">💡</span>}
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{q.content}</p>
                        <p className="text-xs text-green-600 mt-0.5 truncate">정답: {formatAnswerDisplay(q.answer)}</p>
                      </div>

                      {/* 버튼 */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(q)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors
                            ${editId === q.id ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-50'}`}>
                          {editId === q.id ? '편집중' : '수정'}
                        </button>
                        <button onClick={() => handleDelete(q.id)}
                          className="text-xs text-red-400 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 오른쪽: 추가/수정 폼 ── */}
          <div className="flex-1 min-w-0" ref={formRef}>
            <div className="space-y-4">

              {/* 폼 헤더 */}
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">
                  {editId ? `✏️ ${questions.findIndex(q => q.id === editId) + 1}번 문항 수정` : '➕ 새 문항 추가'}
                </h2>
                {editId && (
                  <button onClick={() => { setEditId(null); setForm(emptyForm()); }}
                    className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
                    ✕ 수정 취소
                  </button>
                )}
              </div>

              {/* 기본 정보 */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">

                {/* 유형 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">문제 유형</label>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(TYPE_LABELS) as QuestionType[]).map(t => (
                      <button key={t} type="button"
                        onClick={() => setForm(p => ({ ...p, type: t, answer: '', options: ['', '', '', ''] }))}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all
                          ${form.type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 문제 내용 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">문제 내용 *</label>
                  <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                    rows={3} placeholder="문제를 입력하세요"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>

                {/* 문제 이미지 */}
                <ImageInput examId={examId} value={form.imageUrl}
                  onChange={v => setForm(p => ({ ...p, imageUrl: v }))} label="문제 이미지 (선택)" />

                {/* 객관식 보기 */}
                {form.type === 'multiple' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">보기 항목</label>
                    <div className="space-y-2">
                      {form.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                          <input value={opt} onChange={e => setOpt(i, e.target.value)} placeholder={`보기 ${i + 1}`}
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          {form.options.length > 2 && (
                            <button type="button" onClick={() => delOpt(i)}
                              className="w-6 h-6 rounded-full text-red-400 hover:bg-red-50 flex items-center justify-center text-sm flex-shrink-0">✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addOpt}
                      className="mt-2 text-sm text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">
                      + 보기 추가
                    </button>
                    <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">정답 선택 * <span className="text-xs font-normal text-gray-400">(복수 선택 가능)</span></p>
                      <div className="flex flex-wrap gap-2">
                        {form.options.filter(o => o.trim()).map((rawOpt, i) => {
                          const opt = rawOpt.trim();
                          const checked = splitAnswer(form.answer).includes(opt);
                          return (
                            <button key={i} type="button" onClick={() => toggleAnswer(opt)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border-2 transition-all
                                ${checked ? 'border-green-500 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                              <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center
                                ${checked ? 'border-green-500 bg-green-500' : 'border-gray-400'}`}>
                                {checked && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                        {!form.options.filter(o => o.trim()).length && (
                          <p className="text-xs text-gray-400">보기를 입력하면 클릭으로 정답을 선택할 수 있습니다.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* O/X */}
                {form.type === 'ox' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">정답 *</label>
                    <div className="flex gap-3">
                      {['O', 'X'].map(v => (
                        <label key={v} className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all text-xl font-black
                          ${form.answer === v ? (v === 'O' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-red-500 bg-red-50 text-red-600') : 'border-gray-200 text-gray-300 hover:border-gray-300'}`}>
                          <input type="radio" value={v} checked={form.answer === v} onChange={() => setForm(p => ({ ...p, answer: v }))} className="sr-only" />{v}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* 단답형 / 장문형 */}
                {(form.type === 'short' || form.type === 'long') && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {form.type === 'long' ? '모범 답안 *' : '정답 *'}
                    </label>
                    {form.type === 'long'
                      ? <textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
                          rows={4} placeholder="모범 답안을 입력하세요"
                          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                      : <input value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
                          placeholder="정답을 입력하세요"
                          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    }
                  </div>
                )}

                {/* 배점 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">배점</label>
                  <input type="number" value={form.score} min={1}
                    onChange={e => setForm(p => ({ ...p, score: Number(e.target.value) }))}
                    className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* 저장 버튼 */}
                <button onClick={handleSave} disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-sm">
                  {saving ? '저장 중...' : editId ? '✓ 수정 완료' : '+ 문항 추가'}
                </button>
              </div>

              {/* 해설 카드 */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                <div>
                  <h3 className="font-bold text-amber-800 text-sm">💡 해설 등록 (선택)</h3>
                  <p className="text-xs text-amber-600 mt-0.5">시험 마감 후 결과 화면에서 상담사에게 표시됩니다.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">해설 텍스트</label>
                  <textarea value={form.expText} onChange={e => setForm(p => ({ ...p, expText: e.target.value }))}
                    rows={2} placeholder="정답 근거, 관련 내용 등"
                    className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white" />
                </div>
                <ImageInput examId={examId} value={form.expImageUrl}
                  onChange={v => setForm(p => ({ ...p, expImageUrl: v }))} label="해설 이미지 (선택)" />
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">참고 링크 (KMS 등)</label>
                  {form.expLinks.map((link, i) => (
                    <div key={i} className="flex gap-2 items-start mb-2">
                      <div className="flex-1 space-y-1">
                        <input value={link.label} onChange={e => setLinkF(i, 'label', e.target.value)}
                          placeholder="링크 제목" className="w-full border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" />
                        <input value={link.url} onChange={e => setLinkF(i, 'url', e.target.value)}
                          placeholder="https://..." className="w-full border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" />
                      </div>
                      <button type="button" onClick={() => delLink(i)}
                        className="mt-1 w-6 h-6 rounded-full text-red-400 hover:bg-red-50 flex items-center justify-center text-xs flex-shrink-0">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={addLink}
                    className="text-xs text-amber-700 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors">
                    + 링크 추가
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          일괄 등록 뷰
      ════════════════════════════════════════ */}
      {view === 'bulk' && (
        <div className="flex gap-5 items-start">
          {/* 왼쪽: 현재 문항 목록 미리보기 */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <span className="text-sm font-bold text-gray-700">현재 등록된 문항 ({questions.length})</span>
              </div>
              {questions.length === 0
                ? <p className="p-6 text-center text-xs text-gray-400">등록된 문항 없음</p>
                : (
                  <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="px-3 py-2.5 flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                        <div className="min-w-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mr-1 ${TYPE_COLORS[q.type]}`}>{TYPE_LABELS[q.type]}</span>
                          <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{q.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

          {/* 오른쪽: 일괄 등록 폼 */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* 형식 안내 */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <p className="font-bold text-blue-800 mb-3">📌 일괄 등록 형식</p>
              <div className="space-y-3 text-xs text-blue-800">
                <div>
                  <p className="font-semibold text-blue-700 mb-1">▶ 객관식 — 보기는 줄바꿈, 정답은 보기 텍스트 그대로</p>
                  <pre className="bg-white rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed">{`1. 화물 운송장의 필수 기재 항목이 아닌 것은?
발송인 이름
수취인 주소
운전자 면허번호
화물 중량
정답 : 운전자 면허번호
해설 : 운송장에 면허번호는 기재하지 않습니다.
링크 : https://kms.company.com/123`}</pre>
                </div>
                <div>
                  <p className="font-semibold text-blue-700 mb-1">▶ 단답형 / 장문형([장문]) / O/X</p>
                  <pre className="bg-white rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed">{`2. 배송 완료 처리 시 필수 확인 사항은?
정답 : 수취인 서명
해설 :

3. [장문] 화물 파손 시 처리 절차를 서술하시오.
정답 : 현장 사진 촬영 후 관리자 보고

4. 화물 분실 시 고객에게 즉시 연락한다.
정답 : O`}</pre>
                </div>
                <div className="bg-blue-100 rounded-xl p-3 space-y-1 text-blue-700">
                  <p>⚠️ 객관식 정답은 번호 없이 <strong>보기 텍스트 그대로</strong></p>
                  <p>⚠️ 정답이 여러 개인 경우 <strong>콤마(,)로 구분</strong> (예: 정답 : 보기1, 보기3)</p>
                  <p>⚠️ 등록 후 왼쪽 목록에서 확인 · 문항 관리에서 수정 가능</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">문제 텍스트 붙여넣기</label>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                rows={16} placeholder="위 형식에 맞게 문제를 붙여넣으세요..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleBulk} disabled={bulkSaving}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-bold text-sm transition-colors">
                {bulkSaving ? '등록 중...' : '문항 일괄 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
