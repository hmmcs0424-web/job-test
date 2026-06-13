'use client';

import { useState, useEffect, useRef } from 'react';
import { getExams, getResults, getStaffList, getParts, updateAbsentReason } from '@/lib/firestore';
import type { Exam, Result, Staff, Part } from '@/lib/types';

/* ── 숫자 카운팅 애니메이션 ── */
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    let cur = 0;
    const step = Math.ceil(value / 40) || 1;
    timer.current = setInterval(() => {
      cur = Math.min(cur + step, value);
      setDisplay(cur);
      if (cur >= value && timer.current) clearInterval(timer.current);
    }, 20);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [value]);
  return <>{display}{suffix}</>;
}

/* ── 세로 막대 차트 ── */
const BAR_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ec4899','#14b8a6','#f97316','#6366f1'];

function VBarChart({
  labels,
  datasets,
  barHeight = 160,
  barWidthPct = 60,   // 단일 데이터셋: 막대 폭 (%)
  groupGap = 4,       // 그룹 내 막대 간격(px)
  colorPerBar = false, // 단일 데이터셋에서 막대마다 다른 색
}: {
  labels: string[];
  datasets: { label: string; data: number[]; color: string }[];
  barHeight?: number;
  barWidthPct?: number;
  groupGap?: number;
  colorPerBar?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 200); }, []);
  const innerH = barHeight - 28;
  const maxVal = Math.max(...datasets.flatMap(d => d.data), 1);
  const isSingle = datasets.length === 1;

  return (
    <div>
      <div style={{ height: barHeight }} className="flex items-end">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full px-1">
            <div className="flex items-end justify-center w-full" style={{ gap: groupGap, height: innerH }}>
              {datasets.map((ds, di) => {
                const barColor = colorPerBar && isSingle ? BAR_COLORS[i % BAR_COLORS.length] : ds.color;
                const pct = ds.data[i] / maxVal;
                const h = mounted ? Math.max(Math.round(pct * innerH), 3) : 0;
                return (
                  <div key={di} className="flex flex-col items-center justify-end"
                    style={{ width: isSingle ? `${barWidthPct}%` : `calc(50% - ${groupGap / 2}px)`, height: '100%' }}>
                    {mounted && (
                      <span className="text-xs font-bold mb-1 leading-none" style={{ color: barColor }}>
                        {ds.data[i]}
                      </span>
                    )}
                    <div className="w-full rounded-t-md transition-all duration-700 ease-out"
                      style={{ height: h, background: barColor, transitionDelay: `${i * 50}ms` }} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex mt-2 pt-2 border-t border-gray-100">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center text-xs text-gray-500 leading-tight px-0.5">
            <span className="block" style={{ wordBreak: 'keep-all', lineHeight: '1.3' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   메인 대시보드
══════════════════════════════════════ */
export default function AdminDashboard() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [allResults, setAllResults] = useState<Result[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [parts, setParts] = useState<Part[]>([]);

  const [selectedExamId, setSelectedExamId] = useState('');
  const [compareExamId, setCompareExamId] = useState('');
  const [detailTab, setDetailTab] = useState<'overall' | 'part' | 'staff' | 'question'>('overall');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [absentReasonEdit, setAbsentReasonEdit] = useState<Record<string, string>>({});
  const [savingReason, setSavingReason] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getExams(), getResults(), getStaffList(), getParts()]).then(([e, r, s, p]) => {
      setExams(e); setAllResults(r); setStaff(s); setParts(p);
      if (e.length > 0) setSelectedExamId(e[0].id);
      setLoading(false);
      setTimeout(() => setMounted(true), 100);
    });
  }, []);

  /* 현재 선택 시험 결과 */
  const results = allResults.filter(r => !selectedExamId || r.examId === selectedExamId);
  /* 비교 시험 결과 */
  const compareResults = compareExamId ? allResults.filter(r => r.examId === compareExamId) : [];

  const totalCount = results.length;
  const passCount = results.filter(r => r.passed).length;
  const passRate = totalCount > 0 ? Math.round(passCount / totalCount * 100) : 0;
  const avgScore = totalCount > 0
    ? Math.round(results.reduce((s, r) => s + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / totalCount)
    : 0;

  /* 비교 시험 통계 */
  const cTotal = compareResults.length;
  const cPass = compareResults.filter(r => r.passed).length;
  const cPassRate = cTotal > 0 ? Math.round(cPass / cTotal * 100) : 0;
  const cAvgScore = cTotal > 0
    ? Math.round(compareResults.reduce((s, r) => s + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / cTotal)
    : 0;

  /* 파트별 통계 (현재 시험) */
  const PART_COLORS = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-orange-400', 'bg-pink-500', 'bg-teal-500',
  ];
  const partStats = parts.map((p, i) => {
    const pr = results.filter(r => r.partId === p.id);
    const avg = pr.length > 0
      ? Math.round(pr.reduce((s, r) => s + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / pr.length)
      : 0;
    const cpr = compareResults.filter(r => r.partId === p.id);
    const cAvg = cpr.length > 0
      ? Math.round(cpr.reduce((s, r) => s + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / cpr.length)
      : 0;
    return { part: p, count: pr.length, passCount: pr.filter(r => r.passed).length, avg, cAvg, color: PART_COLORS[i % PART_COLORS.length] };
  });
  const activePartStats = partStats.filter(ps => ps.count > 0);
  const maxAvg = Math.max(...activePartStats.map(ps => Math.max(ps.avg, ps.cAvg)), 100);

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const selectedExam = exams.find(e => e.id === selectedExamId);
  const compareExam = exams.find(e => e.id === compareExamId);

  return (
    <div className="p-8 min-h-screen bg-gray-50">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-400 text-sm mt-0.5">직무테스트 성과를 한눈에 확인하세요</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-500 font-medium">조회 시험</label>
          <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}
            className="border border-gray-200 bg-white rounded-xl px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">전체 시험</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
      </div>

      {/* ═══════════════════════════════════
          상단 3섹션: 응시인원 / 평균점수 / 파트별
      ═══════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-5 mb-6">

        {/* 1. 응시 인원 카드 */}
        {(() => {
          const targetIds = selectedExam?.targetStaffIds ?? [];
          const targetCount = targetIds.length;
          const absentIds = targetIds.filter(id => !results.find(r => r.staffId === id));
          const attendRate = targetCount > 0 ? Math.round((totalCount / targetCount) * 100) : 0;
          return (
            <div
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 0.5s ease 0ms' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{selectedExam?.title ?? '전체'}</span>
              </div>

              {/* 대상 / 응시 수치 */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-gray-700">
                    {mounted ? <AnimatedNumber value={targetCount} suffix="명" /> : '0명'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">대상 인원</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-blue-600">
                    {mounted ? <AnimatedNumber value={totalCount} suffix="명" /> : '0명'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">응시 인원</p>
                </div>
              </div>

              {/* 응시율 게이지 */}
              {targetCount > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>응시율</span>
                    <span className="font-bold text-blue-600">{attendRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-blue-500 transition-all duration-1000"
                      style={{ width: mounted ? `${attendRate}%` : '0%' }} />
                  </div>
                </div>
              )}

              {/* 미응시 인원 목록 + 사유 입력 */}
              {absentIds.length > 0 && selectedExamId && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">미응시 인원 ({absentIds.length}명)</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {absentIds.map(sid => {
                      const s = staff.find(x => x.id === sid);
                      if (!s) return null;
                      const savedReason = selectedExam?.absentReasons?.[sid] ?? '';
                      const editVal = absentReasonEdit[sid] ?? savedReason;
                      return (
                        <div key={sid} className="flex items-center gap-2">
                          <span className="text-xs text-gray-700 font-medium w-14 flex-shrink-0 truncate">{s.name}</span>
                          <input
                            value={editVal}
                            onChange={e => setAbsentReasonEdit(prev => ({ ...prev, [sid]: e.target.value }))}
                            placeholder="미응시 사유"
                            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                          />
                          <button
                            disabled={savingReason === sid}
                            onClick={async () => {
                              setSavingReason(sid);
                              await updateAbsentReason(selectedExamId, sid, editVal);
                              setSavingReason(null);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0 disabled:text-gray-400">
                            {savingReason === sid ? '...' : '저장'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 2. 평균 점수 카드 */}
        <div
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 0.5s ease 100ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>
          <div className="text-4xl font-black text-violet-600 mb-1">
            {mounted ? <AnimatedNumber value={avgScore} suffix="점" /> : '0점'}
          </div>
          <p className="text-gray-500 text-sm font-medium">평균 점수</p>

          {/* 점수 게이지 */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>0점</span>
              <span className="font-semibold text-violet-600">{avgScore}점</span>
              <span>100점</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div className="h-4 rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-1000"
                style={{ width: mounted ? `${avgScore}%` : '0%' }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="font-bold text-emerald-600">{results.filter(r => r.maxScore > 0 && Math.round((r.totalScore / r.maxScore) * 100) === 100).length}명</p>
                <p className="text-gray-400 mt-0.5">100점</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="font-bold text-blue-600">{results.filter(r => { const s = r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : 0; return s >= 90 && s < 100; }).length}명</p>
                <p className="text-gray-400 mt-0.5">90점 이상</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2">
                <p className="font-bold text-yellow-600">{results.filter(r => { const s = r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : 0; return s >= 80 && s < 90; }).length}명</p>
                <p className="text-gray-400 mt-0.5">80점 이상</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2">
                <p className="font-bold text-red-500">{results.filter(r => r.maxScore > 0 && Math.round((r.totalScore / r.maxScore) * 100) < 80).length}명</p>
                <p className="text-gray-400 mt-0.5">80점 미만</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 파트별 점수 차트 */}
        <div
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)', transition: 'all 0.5s ease 200ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">파트별 평균</span>
          </div>
          <p className="text-gray-500 text-sm font-medium mb-4">파트별 평균 점수</p>

          {activePartStats.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">파트 데이터 없음</p>
          ) : (
            <VBarChart
              labels={activePartStats.map(ps => ps.part.name)}
              datasets={[{ label: '평균', data: activePartStats.map(ps => ps.avg), color: '#10b981' }]}
              barHeight={170}
              barWidthPct={50}
              colorPerBar
            />
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════
          이전 시험과 비교 섹션
      ═══════════════════════════════════ */}
      <div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
        style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 300ms' }}>

        {/* 비교 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="font-bold text-gray-900">이전 시험과 비교</h2>
          </div>

          {/* 비교 시험 선택 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-500">{selectedExam?.title ?? '현재 시험'}</span>
            </div>
            <span className="text-gray-300">vs</span>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-400" />
              <select value={compareExamId} onChange={e => setCompareExamId(e.target.value)}
                className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">비교할 시험 선택</option>
                {exams.filter(e => e.id !== selectedExamId).map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!compareExamId ? (
          <div className="py-10 text-center text-gray-400">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm">위에서 비교할 이전 시험을 선택하세요</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 전체 비교 지표 */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '응시 인원', cur: totalCount, prev: cTotal, unit: '명', color: 'text-blue-600' },
                { label: '평균 점수', cur: avgScore, prev: cAvgScore, unit: '점', color: 'text-violet-600' },
                { label: '합격률', cur: passRate, prev: cPassRate, unit: '%', color: 'text-emerald-600' },
              ].map(item => {
                const diff = item.cur - item.prev;
                return (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-2">{item.label}</p>
                    <div className="flex items-center justify-center gap-3">
                      <div>
                        <p className="text-xs text-orange-400 font-medium mb-0.5">{compareExam?.title.slice(0, 8)}...</p>
                        <p className="text-xl font-bold text-gray-400">{item.prev}{item.unit}</p>
                      </div>
                      <div className={`flex flex-col items-center ${diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        <span className="text-lg">{diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}</span>
                        <span className="text-xs font-bold">{diff > 0 ? '+' : ''}{diff}{item.unit}</span>
                      </div>
                      <div>
                        <p className="text-xs text-blue-500 font-medium mb-0.5">{selectedExam?.title.slice(0, 8)}...</p>
                        <p className={`text-xl font-bold ${item.color}`}>{item.cur}{item.unit}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 파트별 비교 세로 막대 차트 */}
            {(() => {
              const cmpStats = partStats.filter(ps => ps.count > 0 || ps.cAvg > 0);
              if (cmpStats.length === 0) {
                return <p className="text-sm text-center text-gray-400 py-4">선택한 이전 시험에 파트별 데이터가 없습니다.</p>;
              }
              return (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <p className="text-sm font-bold text-gray-700">파트별 비교</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#3b82f6' }} />
                        {selectedExam?.title.slice(0, 12)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#f59e0b' }} />
                        {compareExam?.title.slice(0, 12)}
                      </span>
                    </div>
                  </div>
                  <VBarChart
                    labels={cmpStats.map(ps => ps.part.name)}
                    datasets={[
                      { label: selectedExam?.title ?? '현재', data: cmpStats.map(ps => ps.avg), color: '#3b82f6' },
                      { label: compareExam?.title ?? '이전', data: cmpStats.map(ps => ps.cAvg), color: '#f59e0b' },
                    ]}
                    barHeight={240}
                    groupGap={6}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════
          상세 테이블 섹션
      ═══════════════════════════════════ */}
      <div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 400ms' }}>

        <div className="border-b border-gray-100 px-6">
          <div className="flex">
            {[
              { key: 'overall', label: '📋 전체 결과' },
              { key: 'part', label: '🏢 파트별' },
              { key: 'staff', label: '👤 상담사별' },
              { key: 'question', label: '📝 문항별' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setDetailTab(tab.key as typeof detailTab)}
                className={`px-5 py-4 text-sm font-semibold border-b-2 transition-all
                  ${detailTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {detailTab === 'overall' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left text-xs uppercase tracking-wide">
                  <th className="pb-3 font-semibold">이름</th>
                  <th className="pb-3 font-semibold">사번</th>
                  <th className="pb-3 font-semibold">파트</th>
                  <th className="pb-3 font-semibold">점수</th>
                  <th className="pb-3 font-semibold">제출 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 font-semibold text-gray-900">{r.staffName}</td>
                    <td className="py-3 text-gray-400">{r.staffEmployeeId}</td>
                    <td className="py-3 text-gray-500">{parts.find(p => p.id === r.partId)?.name ?? '-'}</td>
                    <td className="py-3 font-medium">{r.totalScore}<span className="text-gray-300">/{r.maxScore}</span></td>
                    <td className="py-3 text-gray-400 text-xs">{new Date(r.submittedAt).toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-300">응시 결과가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {detailTab === 'part' && (
            <div className="space-y-2">
              {activePartStats.length === 0 && (
                <p className="text-center text-gray-400 py-8">파트별 데이터가 없습니다.</p>
              )}
              {activePartStats.map((ps) => (
                <div key={ps.part.id} className="flex items-center gap-4 px-4 py-3 bg-gray-50 rounded-xl hover:bg-blue-50/30 transition-colors">
                  <div className={`w-2.5 h-8 rounded-full flex-shrink-0 ${ps.color}`} />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{ps.part.name}</p>
                    <p className="text-xs text-gray-400">{ps.count}명 응시</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-black text-gray-900">{ps.avg}<span className="text-sm font-normal text-gray-400">점</span></p>
                    <p className="text-xs text-gray-400">평균</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {detailTab === 'staff' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left text-xs uppercase tracking-wide">
                  <th className="pb-3 font-semibold">이름</th>
                  <th className="pb-3 font-semibold">파트</th>
                  <th className="pb-3 font-semibold">최근 점수</th>
                  <th className="pb-3 font-semibold">평균 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map(s => {
                  const sr = allResults.filter(r => r.staffId === s.id);
                  if (!sr.length) return null;
                  const avg = Math.round(sr.reduce((a, r) => a + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / sr.length);
                  const latest = [...sr].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
                  return (
                    <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 font-semibold text-gray-900">{s.name}</td>
                      <td className="py-3 text-gray-500">{parts.find(p => p.id === s.partId)?.name ?? '-'}</td>
                      <td className="py-3 font-medium">{latest.totalScore}<span className="text-gray-300">/{latest.maxScore}</span></td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${avg}%` }} />
                          </div>
                          <span className="font-bold text-gray-700">{avg}점</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {detailTab === 'question' && selectedExamId && (
            <QuestionStats examId={selectedExamId} results={results} />
          )}
          {detailTab === 'question' && !selectedExamId && (
            <div className="py-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📊</div>
              <p>상단에서 시험을 선택해주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionStats({ examId, results }: { examId: string; results: Result[] }) {
  const [questions, setQuestions] = useState<import('@/lib/types').Question[]>([]);
  useEffect(() => {
    import('@/lib/firestore').then(({ getQuestions }) => getQuestions(examId)).then(setQuestions);
  }, [examId]);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-400 text-left text-xs uppercase tracking-wide">
          <th className="pb-3 font-semibold">번호</th>
          <th className="pb-3 font-semibold">문항</th>
          <th className="pb-3 font-semibold">정답률</th>
          <th className="pb-3 font-semibold">정답/전체</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {questions.map((q, idx) => {
          const total = results.length;
          const correct = results.filter(r => r.answers[q.id]?.isCorrect).length;
          const pct = total > 0 ? Math.round(correct / total * 100) : 0;
          return (
            <tr key={q.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3">
                <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold inline-flex items-center justify-center">{idx + 1}</span>
              </td>
              <td className="py-3 max-w-xs truncate text-gray-700">{q.content}</td>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-2.5 rounded-full transition-all ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-orange-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`font-bold text-xs ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-orange-500' : 'text-red-500'}`}>{pct}%</span>
                </div>
              </td>
              <td className="py-3 text-gray-500 text-xs">{correct}<span className="text-gray-300">/{total}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
