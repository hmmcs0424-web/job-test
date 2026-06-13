'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getExam, getQuestions, addQuestion, updateQuestion, deleteQuestion, updateExam } from '@/lib/firestore';
import { parseQuestionsText } from '@/lib/parseQuestions';
import { uploadQuestionImage } from '@/lib/uploadImage';
import type { Exam, Question, QuestionType, Explanation, ExplanationLink } from '@/lib/types';

const typeLabel: Record<QuestionType, string> = {
  multiple: '객관식', short: '단답형', long: '장문형', ox: 'O/X',
};
const typeBadge: Record<QuestionType, string> = {
  multiple: 'bg-blue-100 text-blue-700',
  short: 'bg-emerald-100 text-emerald-700',
  long: 'bg-purple-100 text-purple-700',
  ox: 'bg-orange-100 text-orange-700',
};

/* ─────────────────────────────────────────
   Lightbox (클릭 시 이미지 전체화면)
───────────────────────────────────────── */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <img src={src} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-80 rounded-full w-9 h-9 flex items-center justify-center text-lg">✕</button>
    </div>
  );
}

/* ─────────────────────────────────────────
   클릭 가능한 이미지 (라이트박스 연결)
───────────────────────────────────────── */
function ZoomableImage({ src, className = '' }: { src: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img src={src} alt="" className={`cursor-zoom-in ${className}`} onClick={() => setOpen(true)} />
      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ─────────────────────────────────────────
   이미지 입력 컴포넌트
   - Ctrl+V 붙여넣기 (클립보드 캡처)
   - 파일 선택
   - URL 직접 입력
   - 미리보기 + 라이트박스
───────────────────────────────────────── */
function ImageInput({
  examId,
  value,
  onChange,
  label = '이미지',
  placeholder = '여기에 이미지를 붙여넣거나 (Ctrl+V), 파일을 선택하세요',
}: {
  examId: string;
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [focused, setFocused] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  // 파일 → Firebase Storage 시도 → 실패 시 base64 fallback
  const processFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadQuestionImage(file, examId);
      onChange(url);
    } catch {
      // Storage 권한 없을 경우 base64로 저장
      const reader = new FileReader();
      reader.onload = () => { onChange(reader.result as string); };
      reader.readAsDataURL(file);
    }
    setUploading(false);
  }, [examId, onChange]);

  // 전역 paste 이벤트 (해당 섹션에 focus 되어 있을 때)
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!focused) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      if (imageItem) {
        e.preventDefault();
        const file = imageItem.getAsFile();
        if (file) processFile(file);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [focused, processFile]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function applyUrl() {
    if (urlInput.trim()) { onChange(urlInput.trim()); setUrlInput(''); setShowUrl(false); }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {!value ? (
        <div
          ref={areaRef}
          tabIndex={0}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={() => { areaRef.current?.focus(); }}
          className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors outline-none
            ${focused ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'}`}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <span className="text-sm">업로드 중...</span>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">🖼️</div>
              <p className="text-sm text-gray-500">{placeholder}</p>
              <p className="text-xs text-gray-400 mt-1">클릭하면 붙여넣기 활성화 (테두리가 파란색으로 변함)</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="text-xs bg-white border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 rounded-lg px-3 py-1.5 transition-colors">
                  📁 파일 선택
                </button>
                <button type="button" onClick={e => { e.stopPropagation(); setShowUrl(v => !v); }}
                  className="text-xs bg-white border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 rounded-lg px-3 py-1.5 transition-colors">
                  🔗 URL로 입력
                </button>
              </div>
              {showUrl && (
                <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyUrl()}
                    placeholder="https://..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={applyUrl}
                    className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-blue-700">적용</button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="relative inline-block group">
          <ZoomableImage src={value} className="max-h-48 rounded-xl border border-gray-200 shadow-sm" />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-700 rounded-full w-7 h-7 flex items-center justify-center text-xs shadow border border-gray-200">
              ✎
            </button>
            <button type="button" onClick={() => onChange('')}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow">
              ✕
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">클릭하면 크게 볼 수 있습니다 · 우상단 버튼으로 수정/삭제</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   초기 폼 상태
───────────────────────────────────────── */
function emptyForm() {
  return {
    type: 'multiple' as QuestionType,
    content: '',
    imageUrl: '',
    options: ['', ''],
    answer: '',
    score: 1,
    explanation: { text: '', imageUrl: '', links: [] as ExplanationLink[] },
  };
}

/* ─────────────────────────────────────────
   메인 페이지
───────────────────────────────────────── */
export default function QuestionManage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'bulk'>('list');
  const [msg, setMsg] = useState('');
  const [qForm, setQForm] = useState(emptyForm());
  const [bulkText, setBulkText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const [exam, qs] = await Promise.all([getExam(examId), getQuestions(examId)]);
    setExam(exam);
    setQuestions(qs);
  }

  useEffect(() => { reload().then(() => setLoading(false)); }, [examId]);

  const addOption = () => setQForm(p => ({ ...p, options: [...p.options, ''] }));
  const removeOption = (i: number) => setQForm(p => ({
    ...p, options: p.options.filter((_, idx) => idx !== i),
    answer: p.answer === p.options[i] ? '' : p.answer,
  }));
  const setOption = (i: number, val: string) => setQForm(p => {
    const o = [...p.options]; o[i] = val; return { ...p, options: o };
  });

  const addLink = () => setQForm(p => ({ ...p, explanation: { ...p.explanation, links: [...(p.explanation.links ?? []), { label: '', url: '' }] } }));
  const removeLink = (i: number) => setQForm(p => ({ ...p, explanation: { ...p.explanation, links: (p.explanation.links ?? []).filter((_, idx) => idx !== i) } }));
  const setLink = (i: number, field: 'label' | 'url', val: string) => setQForm(p => {
    const links = [...(p.explanation.links ?? [])]; links[i] = { ...links[i], [field]: val };
    return { ...p, explanation: { ...p.explanation, links } };
  });

  async function handleSaveQuestion() {
    if (!qForm.content || !qForm.answer) { setMsg('문제와 정답을 입력해주세요.'); return; }
    setSaving(true);

    const expText = qForm.explanation.text?.trim();
    const expImage = qForm.explanation.imageUrl?.trim();
    const expLinks = (qForm.explanation.links ?? []).filter(l => l.url.trim());
    const explanation: Explanation | undefined =
      expText || expImage || expLinks.length > 0
        ? { ...(expText ? { text: expText } : {}), ...(expImage ? { imageUrl: expImage } : {}), ...(expLinks.length ? { links: expLinks } : {}) }
        : undefined;

    const data: Omit<Question, 'id'> = {
      examId,
      order: editingId ? questions.find(q => q.id === editingId)?.order ?? questions.length + 1 : questions.length + 1,
      type: qForm.type,
      content: qForm.content.trim(),
      ...(qForm.imageUrl ? { imageUrl: qForm.imageUrl } : {}),
      ...(qForm.type === 'multiple' ? { options: qForm.options.filter(o => o.trim()) } : {}),
      answer: qForm.answer.trim(),
      score: qForm.score,
      ...(explanation ? { explanation } : {}),
    };

    if (editingId) {
      await updateQuestion(editingId, data);
    } else {
      await addQuestion(data);
    }
    await updateExam(examId, { questionCount: questions.length + (editingId ? 0 : 1) });
    setQForm(emptyForm()); setEditingId(null);
    await reload();
    setMsg(editingId ? '수정되었습니다.' : '문항이 추가되었습니다.');
    setActiveTab('list');
    setSaving(false);
    setTimeout(() => setMsg(''), 2000);
  }

  async function handleBulkUpload() {
    if (!bulkText.trim()) return;
    setSaving(true);
    const parsed = parseQuestionsText(bulkText, examId);
    const startOrder = questions.length + 1;
    for (let i = 0; i < parsed.length; i++) await addQuestion({ ...parsed[i], order: startOrder + i });
    await updateExam(examId, { questionCount: questions.length + parsed.length });
    setBulkText(''); await reload();
    setMsg(`${parsed.length}개 문제가 등록되었습니다.`);
    setActiveTab('list'); setSaving(false);
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
      type: q.type, content: q.content, imageUrl: q.imageUrl ?? '',
      options: q.type === 'multiple' ? (q.options?.length ? q.options : ['', '']) : ['', ''],
      answer: q.answer, score: q.score,
      explanation: { text: q.explanation?.text ?? '', imageUrl: q.explanation?.imageUrl ?? '', links: q.explanation?.links ? [...q.explanation.links] : [] },
    });
    setActiveTab('add'); setMsg('');
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
          <button onClick={() => router.push('/admin/exams')} className="text-gray-400 hover:text-gray-600 text-sm mb-1">← 시험 목록</button>
          <h1 className="text-2xl font-bold text-gray-900">{exam?.title} — 문항 관리</h1>
        </div>
        <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">총 {questions.length}문제</div>
      </div>

      {msg && <div className="mb-4 bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm font-medium">{msg}</div>}

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'list', label: '📋 문항 목록' },
          { key: 'add', label: editingId ? '✏️ 문항 수정' : '➕ 문항 추가' },
          { key: 'bulk', label: '📄 일괄 등록' },
        ].map(t => (
          <button key={t.key}
            onClick={() => { setActiveTab(t.key as typeof activeTab); if (t.key !== 'add') { setEditingId(null); setQForm(emptyForm()); } }}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 문항 목록 ── */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 text-sm font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadge[q.type]}`}>{typeLabel[q.type]}</span>
                    <span className="text-xs text-gray-400">{q.score}점</span>
                    {q.imageUrl && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🖼 이미지</span>}
                    {q.explanation && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">💡 풀이</span>}
                  </div>
                  <p className="text-gray-900 font-medium">{q.content}</p>
                  {q.imageUrl && (
                    <div className="mt-2">
                      <ZoomableImage src={q.imageUrl} className="max-h-36 rounded-lg border border-gray-200 shadow-sm" />
                    </div>
                  )}
                  {q.type === 'multiple' && q.options && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.options.map((opt, oi) => (
                        <span key={oi} className={`text-sm px-3 py-1 rounded-lg ${opt === q.answer ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-100 text-gray-600'}`}>
                          {opt}{opt === q.answer && ' ✓'}
                        </span>
                      ))}
                    </div>
                  )}
                  {q.type !== 'multiple' && (
                    <div className="mt-2 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-lg inline-block">
                      정답: {q.answer}
                    </div>
                  )}
                  {q.explanation && (
                    <div className="mt-2 bg-yellow-50 rounded-lg p-3 text-sm text-gray-700 space-y-1.5 border border-yellow-100">
                      <p className="text-xs font-semibold text-yellow-700">💡 풀이</p>
                      {q.explanation.text && <p className="whitespace-pre-wrap text-gray-700">{q.explanation.text}</p>}
                      {q.explanation.imageUrl && (
                        <div>
                          <ZoomableImage src={q.explanation.imageUrl} className="max-h-36 rounded-lg border border-yellow-200" />
                        </div>
                      )}
                      {q.explanation.links?.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                          🔗 {l.label || l.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(q)} className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded hover:bg-blue-50">수정</button>
                  <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50">삭제</button>
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

      {/* ── 문항 추가/수정 ── */}
      {activeTab === 'add' && (
        <div className="max-w-2xl space-y-4">
          {/* 기본 정보 */}
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <h2 className="font-bold text-gray-800 text-lg">{editingId ? '문항 수정' : '새 문항 추가'}</h2>

            {/* 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">문제 유형</label>
              <div className="flex gap-2 flex-wrap">
                {(['multiple', 'short', 'long', 'ox'] as QuestionType[]).map(t => (
                  <button key={t} type="button"
                    onClick={() => setQForm(p => ({ ...p, type: t, answer: '', options: ['', ''] }))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${qForm.type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {typeLabel[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* 문제 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">문제 내용 *</label>
              <textarea value={qForm.content} onChange={e => setQForm(p => ({ ...p, content: e.target.value }))}
                rows={3} placeholder="문제를 입력하세요"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {/* 문제 이미지 */}
            <ImageInput
              examId={examId} value={qForm.imageUrl}
              onChange={url => setQForm(p => ({ ...p, imageUrl: url }))}
              label="문제 이미지 (선택)"
              placeholder="여기를 클릭 후 Ctrl+V로 캡처 이미지를 붙여넣거나, 파일을 선택하세요"
            />

            {/* 객관식 보기 */}
            {qForm.type === 'multiple' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">보기 항목</label>
                <div className="space-y-2">
                  {qForm.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                      <input value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`보기 ${i + 1}`}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {qForm.options.length > 2 && (
                        <button type="button" onClick={() => removeOption(i)}
                          className="text-red-400 hover:text-red-600 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 flex-shrink-0 text-sm">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addOption}
                  className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">
                  + 보기 추가
                </button>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">정답 선택 *</label>
                  <div className="flex flex-wrap gap-2">
                    {qForm.options.filter(o => o.trim()).map((opt, i) => (
                      <button key={i} type="button" onClick={() => setQForm(p => ({ ...p, answer: opt }))}
                        className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-colors ${qForm.answer === opt ? 'border-green-500 bg-green-50 text-green-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-green-300'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                  {qForm.options.filter(o => o.trim()).length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">보기를 입력하면 클릭으로 정답을 선택할 수 있습니다.</p>
                  )}
                </div>
              </div>
            )}

            {/* O/X */}
            {qForm.type === 'ox' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">정답 *</label>
                <div className="flex gap-3">
                  {['O', 'X'].map(v => (
                    <label key={v} className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer font-bold text-2xl transition-colors ${qForm.answer === v ? (v === 'O' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-red-500 bg-red-50 text-red-600') : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                      <input type="radio" value={v} checked={qForm.answer === v} onChange={() => setQForm(p => ({ ...p, answer: v }))} className="sr-only" />{v}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 단답형/장문형 */}
            {(qForm.type === 'short' || qForm.type === 'long') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{qForm.type === 'long' ? '모범 답안 *' : '정답 *'}</label>
                {qForm.type === 'long' ? (
                  <textarea value={qForm.answer} onChange={e => setQForm(p => ({ ...p, answer: e.target.value }))}
                    rows={4} placeholder="모범 답안을 입력하세요"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                ) : (
                  <input value={qForm.answer} onChange={e => setQForm(p => ({ ...p, answer: e.target.value }))}
                    placeholder="정답을 입력하세요"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
              </div>
            )}

            {/* 배점 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">배점</label>
              <input type="number" value={qForm.score} min={1}
                onChange={e => setQForm(p => ({ ...p, score: Number(e.target.value) }))}
                className="w-32 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {msg && activeTab === 'add' && <p className="text-red-500 text-sm">{msg}</p>}

            <div className="flex gap-3">
              <button onClick={handleSaveQuestion} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-semibold">
                {saving ? '저장 중...' : editingId ? '수정 완료' : '문항 추가'}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setQForm(emptyForm()); setActiveTab('list'); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-3 rounded-xl font-medium">취소</button>
              )}
            </div>
          </div>

          {/* 풀이 섹션 */}
          <div className="bg-amber-50 rounded-2xl shadow-sm p-6 space-y-4 border border-amber-200">
            <div>
              <h3 className="font-bold text-amber-800 text-base">💡 풀이 등록 (선택)</h3>
              <p className="text-xs text-amber-700 mt-0.5">시험 마감 후 결과 화면에서 상담사에게 표시됩니다.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">풀이 설명</label>
              <textarea value={qForm.explanation.text}
                onChange={e => setQForm(p => ({ ...p, explanation: { ...p.explanation, text: e.target.value } }))}
                rows={3} placeholder="정답 설명, 관련 근거 등을 입력하세요"
                className="w-full border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white" />
            </div>

            <ImageInput
              examId={examId} value={qForm.explanation.imageUrl}
              onChange={url => setQForm(p => ({ ...p, explanation: { ...p.explanation, imageUrl: url } }))}
              label="풀이 이미지 (선택)"
              placeholder="캡처 이미지를 붙여넣거나 파일을 선택하세요"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">참고 링크 (KMS 등)</label>
              <div className="space-y-2">
                {(qForm.explanation.links ?? []).map((link, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <input value={link.label} onChange={e => setLink(i, 'label', e.target.value)}
                        placeholder="링크 제목 (예: KMS 참고자료)"
                        className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                      <input value={link.url} onChange={e => setLink(i, 'url', e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                    </div>
                    <button type="button" onClick={() => removeLink(i)}
                      className="text-red-400 hover:text-red-600 mt-1 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 flex-shrink-0">✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addLink}
                className="mt-2 flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 px-2 py-1 rounded hover:bg-amber-100">
                + 링크 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 일괄 등록 ── */}
      {activeTab === 'bulk' && (
        <div className="max-w-2xl">
          <div className="bg-blue-50 rounded-2xl p-5 mb-4 text-sm text-blue-800 border border-blue-200">
            <p className="font-bold mb-3 text-base">📌 일괄 등록 형식 안내</p>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold text-blue-700 mb-1">▶ 객관식 (보기는 - 로 시작, 정답은 텍스트 그대로)</p>
                <pre className="bg-white rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{`1. 화물 운송장의 필수 기재 항목이 아닌 것은?
- 발송인 이름
- 수취인 주소
- 운전자 면허번호
- 화물 중량
정답: 운전자 면허번호
풀이: 운송장에는 운전자 이름이 기재되며 면허번호는 해당 없습니다.
링크: https://kms.company.com/article/123`}</pre>
              </div>
              <div>
                <p className="font-semibold text-blue-700 mb-1">▶ 단답형</p>
                <pre className="bg-white rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{`2. 배송 완료 처리 시 필수 확인 사항은?
정답: 수취인 서명`}</pre>
              </div>
              <div>
                <p className="font-semibold text-blue-700 mb-1">▶ 장문형 (제목 앞에 [장문] 표시)</p>
                <pre className="bg-white rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{`3. [장문] 화물 파손 발생 시 처리 절차를 서술하시오.
정답: 현장 사진 촬영 후 관리자 보고, 고객 안내
풀이: 증거 확보가 핵심입니다.`}</pre>
              </div>
              <div>
                <p className="font-semibold text-blue-700 mb-1">▶ O/X</p>
                <pre className="bg-white rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{`4. 화물 분실 시 고객에게 즉시 연락해야 한다.
정답: O`}</pre>
              </div>
              <p className="text-blue-600 font-medium pt-1">
                ⚠️ 객관식 정답은 번호가 아닌 보기 텍스트 그대로 입력 (문항·보기 순서가 자동으로 섞입니다)<br/>
                링크는 <code className="bg-white px-1 rounded">링크: https://...</code> 형태로 여러 줄 추가 가능
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">문제 텍스트 붙여넣기</label>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
              rows={18} placeholder="위 형식에 맞게 문제를 붙여넣으세요..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none" />
            <button onClick={handleBulkUpload} disabled={saving}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-semibold">
              {saving ? '등록 중...' : '문제 일괄 등록'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
