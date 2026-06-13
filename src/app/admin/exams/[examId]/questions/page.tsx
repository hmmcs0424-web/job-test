'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getExam, getQuestions, addQuestion, updateQuestion,
  deleteQuestion, updateExam,
} from '@/lib/firestore';
import { parseQuestionsText } from '@/lib/parseQuestions';
import { uploadQuestionImage } from '@/lib/uploadImage';
import type { Exam, Question, QuestionType, Explanation, ExplanationLink } from '@/lib/types';

/* ─── 타입 레이블 ─── */
const TYPE_LABELS: Record<QuestionType, string> = {
  multiple: '객관식', short: '단답형', long: '장문형', ox: 'O/X',
};
const TYPE_COLORS: Record<QuestionType, string> = {
  multiple: 'bg-blue-100 text-blue-700',
  short: 'bg-emerald-100 text-emerald-700',
  long: 'bg-purple-100 text-purple-700',
  ox: 'bg-orange-100 text-orange-700',
};

/* ─────────────────────────────────────────
   라이트박스
───────────────────────────────────────── */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out" onClick={onClose}>
      <img src={src} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-lg transition-colors">✕</button>
    </div>
  );
}

function ZoomImg({ src, className = '' }: { src: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <img src={src} alt="" className={`cursor-zoom-in hover:opacity-90 transition-opacity ${className}`} onClick={() => setOpen(true)} />
      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ─────────────────────────────────────────
   이미지 입력 컴포넌트
   ① Ctrl+V 붙여넣기  ② 파일 선택  ③ URL 입력
───────────────────────────────────────── */
function ImageInput({
  examId, value, onChange, label = '이미지 첨부 (선택)',
}: {
  examId: string; value: string; onChange: (v: string) => void; label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  /* 파일 → Storage or base64 */
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

  /* 전역 paste — 이 영역이 focused 일 때만 */
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      if (!focused) return;
      const img = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (img) { e.preventDefault(); const f = img.getAsFile(); if (f) processFile(f); }
    };
    document.addEventListener('paste', h);
    return () => document.removeEventListener('paste', h);
  }, [focused, processFile]);

  if (value) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1.5">{label}</p>
        <div className="relative inline-block group">
          <ZoomImg src={value} className="max-h-44 rounded-xl border border-gray-200 shadow-sm" />
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" title="교체" onClick={() => fileRef.current?.click()}
              className="w-7 h-7 bg-white/90 hover:bg-white border border-gray-200 rounded-full flex items-center justify-center text-sm shadow">✎</button>
            <button type="button" title="삭제" onClick={() => onChange('')}
              className="w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm shadow">✕</button>
          </div>
          <p className="text-xs text-gray-400 mt-1">클릭하면 크게 볼 수 있습니다</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1.5">{label}</p>
      <div
        ref={boxRef} tabIndex={0}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer outline-none transition-colors
          ${focused ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'}`}
        onClick={() => boxRef.current?.focus()}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-blue-600 py-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span className="text-sm">업로드 중...</span>
          </div>
        ) : (
          <>
            <p className="text-2xl mb-1">🖼️</p>
            <p className="text-sm text-gray-500">
              {focused ? '👉 Ctrl+V로 붙여넣기' : '클릭 후 Ctrl+V 붙여넣기'}
            </p>
            {focused && <p className="text-xs text-blue-500 mt-0.5">파란 테두리 = 붙여넣기 활성화됨</p>}
            <div className="flex justify-center gap-2 mt-3">
              <button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                className="text-xs bg-white border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 rounded-lg px-3 py-1.5 transition-colors">
                📁 파일 선택
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); setShowUrl(v => !v); }}
                className="text-xs bg-white border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 rounded-lg px-3 py-1.5 transition-colors">
                🔗 URL 입력
              </button>
            </div>
            {showUrl && (
              <div className="mt-2 flex gap-2" onClick={e => e.stopPropagation()}>
                <input type="url" value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && urlDraft.trim()) { onChange(urlDraft.trim()); setUrlDraft(''); setShowUrl(false); } }}
                  placeholder="https://..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button"
                  onClick={() => { if (urlDraft.trim()) { onChange(urlDraft.trim()); setUrlDraft(''); setShowUrl(false); } }}
                  className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-blue-700">적용</button>
              </div>
            )}
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
    </div>
  );
}

/* ─────────────────────────────────────────
   빈 폼
───────────────────────────────────────── */
function emptyForm() {
  return {
    type: 'multiple' as QuestionType,
    content: '',
    imageUrl: '',
    options: ['', '', '', ''],
    answer: '',
    score: 1,
    expText: '',
    expImageUrl: '',
    expLinks: [] as ExplanationLink[],
  };
}

/* ─────────────────────────────────────────
   메인
───────────────────────────────────────── */
export default function QuestionManage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'add' | 'bulk'>('list');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  async function reload() {
    const [e, qs] = await Promise.all([getExam(examId), getQuestions(examId)]);
    setExam(e); setQuestions(qs);
  }
  useEffect(() => { reload().then(() => setLoading(false)); }, [examId]);

  /* 옵션 관리 */
  const setOpt = (i: number, v: string) => setForm(p => { const o = [...p.options]; o[i] = v; return { ...p, options: o }; });
  const addOpt = () => setForm(p => ({ ...p, options: [...p.options, ''] }));
  const delOpt = (i: number) => setForm(p => ({
    ...p,
    options: p.options.filter((_, idx) => idx !== i),
    answer: p.answer === p.options[i] ? '' : p.answer,
  }));

  /* 링크 관리 */
  const addLink = () => setForm(p => ({ ...p, expLinks: [...p.expLinks, { label: '', url: '' }] }));
  const delLink = (i: number) => setForm(p => ({ ...p, expLinks: p.expLinks.filter((_, idx) => idx !== i) }));
  const setLinkField = (i: number, f: 'label' | 'url', v: string) => setForm(p => {
    const links = [...p.expLinks]; links[i] = { ...links[i], [f]: v };
    return { ...p, expLinks: links };
  });

  /* 저장 */
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
      ...(form.type === 'multiple' ? { options: form.options.filter(o => o.trim()) } : {}),
      ...(explanation ? { explanation } : {}),
    };

    if (editId) await updateQuestion(editId, data);
    else await addQuestion(data);

    await updateExam(examId, { questionCount: questions.length + (editId ? 0 : 1) });
    await reload();
    showToast(editId ? '수정되었습니다.' : '문항이 추가되었습니다.');
    setForm(emptyForm()); setEditId(null); setTab('list');
    setSaving(false);
  }

  /* 일괄 등록 */
  async function handleBulk() {
    if (!bulkText.trim()) return;
    setSaving(true);
    try {
      const parsed = parseQuestionsText(bulkText, examId);
      if (parsed.length === 0) { showToast('파싱된 문항이 없습니다. 형식을 확인해주세요.'); setSaving(false); return; }
      for (let i = 0; i < parsed.length; i++) {
        await addQuestion({ ...parsed[i], order: questions.length + i + 1 });
      }
      await updateExam(examId, { questionCount: questions.length + parsed.length });
      await reload();
      showToast(`${parsed.length}개 문항이 등록되었습니다.`);
      setBulkText(''); setTab('list');
    } catch (err) {
      showToast('등록 중 오류가 발생했습니다. 형식을 확인해주세요.');
      console.error(err);
    }
    setSaving(false);
  }

  /* 삭제 */
  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteQuestion(id);
    await updateExam(examId, { questionCount: Math.max(0, questions.length - 1) });
    await reload();
  }

  /* 수정 시작 */
  function startEdit(q: Question) {
    setForm({
      type: q.type, content: q.content, imageUrl: q.imageUrl ?? '',
      options: q.type === 'multiple' ? [...(q.options ?? []), '', '', '', ''].slice(0, Math.max(4, (q.options?.length ?? 0))) : ['', '', '', ''],
      answer: q.answer, score: q.score,
      expText: q.explanation?.text ?? '',
      expImageUrl: q.explanation?.imageUrl ?? '',
      expLinks: q.explanation?.links ? [...q.explanation.links] : [],
    });
    setEditId(q.id); setTab('add');
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/admin/exams')} className="text-gray-400 hover:text-gray-600 text-sm mb-1 flex items-center gap-1">
            ← 시험 목록
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{exam?.title} — 문항 관리</h1>
        </div>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">총 {questions.length}문제</span>
      </div>

      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
          {toast}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[
          { key: 'list', label: '문항 목록' },
          { key: 'add', label: editId ? '문항 수정' : '문항 추가' },
          { key: 'bulk', label: '일괄 등록' },
        ].map(t => (
          <button key={t.key}
            onClick={() => { setTab(t.key as typeof tab); if (t.key !== 'add') { setEditId(null); setForm(emptyForm()); } }}
            className={`px-6 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors
              ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════
          문항 목록
      ════════════════════════════════ */}
      {tab === 'list' && (
        <div className="space-y-3 max-w-3xl">
          {questions.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400 shadow-sm">
              아직 문항이 없습니다. 위 탭에서 추가하거나 일괄 등록하세요.
            </div>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[q.type]}`}>{TYPE_LABELS[q.type]}</span>
                    <span className="text-xs text-gray-400">{q.score}점</span>
                    {q.imageUrl && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🖼 이미지</span>}
                    {q.explanation && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">💡 해설</span>}
                  </div>
                  <p className="text-gray-900 font-medium text-sm leading-relaxed">{q.content}</p>
                  {q.imageUrl && <div className="mt-2"><ZoomImg src={q.imageUrl} className="max-h-32 rounded-lg border border-gray-200" /></div>}

                  {q.type === 'multiple' && q.options && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.options.map((opt, oi) => (
                        <span key={oi} className={`text-xs px-3 py-1.5 rounded-lg font-medium
                          ${opt === q.answer ? 'bg-green-100 text-green-700 ring-1 ring-green-400' : 'bg-gray-100 text-gray-600'}`}>
                          {opt}{opt === q.answer ? ' ✓' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {q.type !== 'multiple' && (
                    <div className="mt-2 inline-block bg-green-50 text-green-700 text-sm px-3 py-1.5 rounded-lg font-medium">
                      정답: {q.answer}
                    </div>
                  )}
                  {q.explanation && (
                    <div className="mt-3 bg-amber-50 rounded-xl p-3 border border-amber-100 space-y-1.5">
                      <p className="text-xs font-bold text-amber-700">💡 해설</p>
                      {q.explanation.text && <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.explanation.text}</p>}
                      {q.explanation.imageUrl && <ZoomImg src={q.explanation.imageUrl} className="max-h-32 rounded-lg border border-amber-200 mt-1" />}
                      {q.explanation.links?.map((l, li) => (
                        <a key={li} href={l.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          🔗 {l.label || l.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <button onClick={() => startEdit(q)} className="text-blue-600 hover:bg-blue-50 text-xs px-2.5 py-1.5 rounded-lg transition-colors">수정</button>
                  <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:bg-red-50 text-xs px-2.5 py-1.5 rounded-lg transition-colors">삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════
          문항 추가 / 수정
      ════════════════════════════════ */}
      {tab === 'add' && (
        <div className="max-w-2xl space-y-5">
          {/* 기본 정보 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="font-bold text-gray-900 text-base">{editId ? '문항 수정' : '새 문항 추가'}</h2>

            {/* 유형 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">문제 유형</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(TYPE_LABELS) as QuestionType[]).map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(p => ({ ...p, type: t, answer: '', options: ['', '', '', ''] }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all
                      ${form.type === t ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* 문제 내용 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">문제 내용 *</label>
              <textarea value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                rows={3} placeholder="문제를 입력하세요"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {/* 문제 이미지 */}
            <ImageInput
              examId={examId} value={form.imageUrl}
              onChange={v => setForm(p => ({ ...p, imageUrl: v }))}
              label="문제 이미지 (선택)"
            />

            {/* 객관식 보기 */}
            {form.type === 'multiple' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">보기 항목</label>
                <div className="space-y-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      <input value={opt} onChange={e => setOpt(i, e.target.value)}
                        placeholder={`보기 ${i + 1}`}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {form.options.length > 2 && (
                        <button type="button" onClick={() => delOpt(i)}
                          className="w-7 h-7 rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-sm transition-colors flex-shrink-0">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addOpt}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">
                  + 보기 추가
                </button>

                {/* 정답 클릭 선택 */}
                <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">정답 선택 *</p>
                  <div className="flex flex-wrap gap-2">
                    {form.options.filter(o => o.trim()).map((opt, i) => (
                      <button key={i} type="button" onClick={() => setForm(p => ({ ...p, answer: opt }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border-2 transition-all
                          ${form.answer === opt
                            ? 'border-green-500 bg-green-50 text-green-700 font-semibold shadow-sm'
                            : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50/50'}`}>
                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                          ${form.answer === opt ? 'border-green-500 bg-green-500' : 'border-gray-400'}`}>
                          {form.answer === opt && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                        {opt}
                      </button>
                    ))}
                    {form.options.filter(o => o.trim()).length === 0 && (
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
                    <label key={v}
                      className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-2xl font-black
                        ${form.answer === v
                          ? v === 'O' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-red-500 bg-red-50 text-red-600'
                          : 'border-gray-200 text-gray-300 hover:border-gray-300'}`}>
                      <input type="radio" value={v} checked={form.answer === v}
                        onChange={() => setForm(p => ({ ...p, answer: v }))} className="sr-only" />
                      {v}
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
                className="w-28 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-sm">
                {saving ? '저장 중...' : editId ? '수정 완료' : '문항 추가'}
              </button>
              {editId && (
                <button onClick={() => { setEditId(null); setForm(emptyForm()); setTab('list'); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-3 rounded-xl font-medium text-sm transition-colors">
                  취소
                </button>
              )}
            </div>
          </div>

          {/* 해설 카드 */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="font-bold text-amber-800 text-base">💡 해설 등록 (선택)</h3>
              <p className="text-xs text-amber-600 mt-0.5">시험 마감 후 결과 화면에서 상담사에게 표시됩니다.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">해설 텍스트</label>
              <textarea value={form.expText}
                onChange={e => setForm(p => ({ ...p, expText: e.target.value }))}
                rows={3} placeholder="정답 근거, 관련 내용 등을 입력하세요"
                className="w-full border border-amber-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white" />
            </div>

            <ImageInput
              examId={examId} value={form.expImageUrl}
              onChange={v => setForm(p => ({ ...p, expImageUrl: v }))}
              label="해설 이미지 (선택)"
            />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">참고 링크 (KMS 등)</label>
              <div className="space-y-2">
                {form.expLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <input value={link.label} onChange={e => setLinkField(i, 'label', e.target.value)}
                        placeholder="링크 제목 (예: KMS 참고자료)"
                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                      <input value={link.url} onChange={e => setLinkField(i, 'url', e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                    </div>
                    <button type="button" onClick={() => delLink(i)}
                      className="mt-1 w-7 h-7 rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center flex-shrink-0 transition-colors">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addLink}
                className="mt-2 text-sm text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors">
                + 링크 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          일괄 등록
      ════════════════════════════════ */}
      {tab === 'bulk' && (
        <div className="max-w-2xl">
          {/* 형식 안내 */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
            <p className="font-bold text-blue-800 text-base mb-3">📌 일괄 등록 형식</p>
            <div className="space-y-3 text-xs text-blue-800">
              <div>
                <p className="font-semibold text-blue-700 mb-1">▶ 객관식 — 보기는 줄바꿈으로 구분, 정답은 보기 텍스트 그대로</p>
                <pre className="bg-white rounded-xl p-3 whitespace-pre-wrap leading-relaxed font-mono">{`1. 화물 운송장의 필수 기재 항목이 아닌 것은?
발송인 이름
수취인 주소
운전자 면허번호
화물 중량
정답 : 운전자 면허번호
해설 : 운송장에 면허번호는 기재하지 않습니다.
링크 : https://kms.company.com/article/123`}</pre>
              </div>
              <div>
                <p className="font-semibold text-blue-700 mb-1">▶ 단답형</p>
                <pre className="bg-white rounded-xl p-3 whitespace-pre-wrap leading-relaxed font-mono">{`2. 배송 완료 처리 시 필수 확인 사항은?
정답 : 수취인 서명
해설 :`}</pre>
              </div>
              <div>
                <p className="font-semibold text-blue-700 mb-1">▶ 장문형 — 문제 앞에 [장문] 추가</p>
                <pre className="bg-white rounded-xl p-3 whitespace-pre-wrap leading-relaxed font-mono">{`3. [장문] 화물 파손 발생 시 처리 절차를 서술하시오.
정답 : 현장 사진 촬영 후 관리자 보고, 고객 안내`}</pre>
              </div>
              <div>
                <p className="font-semibold text-blue-700 mb-1">▶ O/X</p>
                <pre className="bg-white rounded-xl p-3 whitespace-pre-wrap leading-relaxed font-mono">{`4. 화물 분실 시 고객에게 즉시 연락한다.
정답 : O`}</pre>
              </div>
              <div className="bg-blue-100 rounded-xl p-3 space-y-1 text-blue-700">
                <p>⚠️ <strong>객관식 정답은 번호가 아닌 보기 텍스트 그대로</strong> 입력</p>
                <p>⚠️ 문항·보기 순서는 응시자마다 <strong>자동으로 섞임</strong> (컨닝 방지)</p>
                <p>⚠️ <code className="bg-white px-1 rounded">정답 :</code> 앞의 줄들이 2개 이상이면 자동으로 객관식 감지</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">문제 텍스트 붙여넣기</label>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
              rows={20} placeholder="위 형식에 맞게 문제를 붙여넣으세요..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleBulk} disabled={saving}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-sm">
              {saving ? '등록 중...' : '문항 일괄 등록'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
