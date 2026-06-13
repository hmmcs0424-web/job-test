'use client';

import { useState, useEffect, useRef } from 'react';
import { getExams, getResults, getStaffList, getParts } from '@/lib/firestore';
import type { Exam, Result, Staff, Part } from '@/lib/types';

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const duration = 800;
    const step = Math.ceil(end / (duration / 16));
    ref.current = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end && ref.current) clearInterval(ref.current);
    }, 16);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [value]);

  return <>{display}{suffix}</>;
}

export default function AdminDashboard() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [activeTab, setActiveTab] = useState<'overall' | 'part' | 'staff' | 'question'>('overall');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.all([getExams(), getResults(), getStaffList(), getParts()]).then(([e, r, s, p]) => {
      setExams(e);
      setResults(r);
      setStaff(s);
      setParts(p);
      if (e.length > 0) setSelectedExamId(e[0].id);
      setLoading(false);
      setTimeout(() => setMounted(true), 50);
    });
  }, []);

  const filteredResults = results.filter(r => !selectedExamId || r.examId === selectedExamId);
  const selectedExam = exams.find(e => e.id === selectedExamId);

  const totalCount = filteredResults.length;
  const passCount = filteredResults.filter(r => r.passed).length;
  const passRate = totalCount > 0 ? Math.round(passCount / totalCount * 100) : 0;
  const avgScore = totalCount > 0
    ? Math.round(filteredResults.reduce((s, r) => s + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / totalCount)
    : 0;

  const partStats = parts.map(p => {
    const pr = filteredResults.filter(r => r.partId === p.id);
    const avg = pr.length > 0
      ? Math.round(pr.reduce((s, r) => s + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / pr.length)
      : 0;
    return { part: p, count: pr.length, passCount: pr.filter(r => r.passed).length, avg };
  }).filter(ps => ps.count > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      label: '응시 인원',
      value: totalCount,
      suffix: '명',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-blue-600',
      bg: 'from-blue-50 to-blue-100',
      text: 'text-blue-600',
      shadow: 'shadow-blue-200',
    },
    {
      label: '합격 인원',
      value: passCount,
      suffix: '명',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-emerald-500 to-green-600',
      bg: 'from-emerald-50 to-green-100',
      text: 'text-emerald-600',
      shadow: 'shadow-emerald-200',
    },
    {
      label: '합격률',
      value: passRate,
      suffix: '%',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      gradient: 'from-violet-500 to-purple-600',
      bg: 'from-violet-50 to-purple-100',
      text: 'text-violet-600',
      shadow: 'shadow-violet-200',
    },
    {
      label: '평균 점수',
      value: avgScore,
      suffix: '점',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      gradient: 'from-orange-400 to-rose-500',
      bg: 'from-orange-50 to-rose-100',
      text: 'text-orange-500',
      shadow: 'shadow-orange-200',
    },
  ];

  const tabs = [
    { key: 'overall', label: '전체 결과', icon: '📋' },
    { key: 'part', label: '파트별', icon: '🏢' },
    { key: 'staff', label: '상담사별', icon: '👤' },
    { key: 'question', label: '문항별', icon: '📝' },
  ];

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">직무테스트 현황을 한눈에 확인하세요</p>
        </div>
        <select
          value={selectedExamId}
          onChange={e => setSelectedExamId(e.target.value)}
          className="border border-gray-200 bg-white rounded-xl px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 시험</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.bg} shadow-lg ${card.shadow} transition-all duration-500 hover:scale-105 hover:shadow-xl`}
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: `opacity 0.5s ease ${i * 100}ms, transform 0.5s ease ${i * 100}ms, box-shadow 0.3s ease, scale 0.3s ease`,
            }}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-md`}>
                  {card.icon}
                </div>
                <div className={`text-xs font-semibold ${card.text} bg-white bg-opacity-60 rounded-full px-2.5 py-1`}>
                  {selectedExam ? '선택된 시험' : '전체'}
                </div>
              </div>
              <div className={`text-3xl font-black ${card.text} mb-1`}>
                {mounted ? <AnimatedNumber value={card.value} suffix={card.suffix} /> : `0${card.suffix}`}
              </div>
              <div className="text-gray-600 text-sm font-medium">{card.label}</div>
            </div>
            {/* Decorative circle */}
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-br ${card.gradient} opacity-10`} />
          </div>
        ))}
      </div>

      {/* Pass Rate Bar */}
      {totalCount > 0 && (
        <div
          className="bg-white rounded-2xl shadow-sm p-5 mb-6"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.5s ease 400ms, transform 0.5s ease 400ms',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">전체 합격률 현황</span>
            <span className="text-sm font-bold text-gray-900">{passRate}%</span>
          </div>
          <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-4 rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-1000"
              style={{ width: mounted ? `${passRate}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>합격 {passCount}명</span>
            <span>불합격 {totalCount - passCount}명</span>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div
        className="bg-white rounded-2xl shadow-sm overflow-hidden"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.5s ease 500ms, transform 0.5s ease 500ms',
        }}
      >
        <div className="border-b border-gray-100 px-6">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-5 py-4 text-sm font-medium border-b-2 transition-all duration-200 flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overall' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left text-xs uppercase tracking-wide">
                  <th className="pb-4 font-semibold">이름</th>
                  <th className="pb-4 font-semibold">사번</th>
                  <th className="pb-4 font-semibold">파트</th>
                  <th className="pb-4 font-semibold">점수</th>
                  <th className="pb-4 font-semibold">결과</th>
                  <th className="pb-4 font-semibold">제출 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredResults.map(r => (
                  <tr key={r.id} className="hover:bg-blue-50 transition-colors">
                    <td className="py-3 font-semibold text-gray-900">{r.staffName}</td>
                    <td className="py-3 text-gray-500">{r.staffEmployeeId}</td>
                    <td className="py-3 text-gray-500">{parts.find(p => p.id === r.partId)?.name ?? '-'}</td>
                    <td className="py-3 font-medium">{r.totalScore}<span className="text-gray-400">/{r.maxScore}</span></td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {r.passed ? '✓ 합격' : '✗ 불합격'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400 text-xs">{new Date(r.submittedAt).toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
                {filteredResults.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">아직 응시 결과가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'part' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left text-xs uppercase tracking-wide">
                  <th className="pb-4 font-semibold">파트</th>
                  <th className="pb-4 font-semibold">응시 인원</th>
                  <th className="pb-4 font-semibold">합격 인원</th>
                  <th className="pb-4 font-semibold">합격률</th>
                  <th className="pb-4 font-semibold">평균 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {partStats.map((ps, i) => {
                  const rate = ps.count > 0 ? Math.round(ps.passCount / ps.count * 100) : 0;
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-400', 'bg-pink-500'];
                  return (
                    <tr key={ps.part.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                          <span className="font-semibold text-gray-900">{ps.part.name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-gray-600">{ps.count}명</td>
                      <td className="py-4 text-gray-600">{ps.passCount}명</td>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-28 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div className={`${colors[i % colors.length]} h-2.5 rounded-full transition-all duration-700`} style={{ width: `${rate}%` }} />
                          </div>
                          <span className="font-semibold text-gray-700 w-10">{rate}%</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="font-semibold text-gray-900">{ps.avg}</span>
                        <span className="text-gray-400 text-xs">점</span>
                      </td>
                    </tr>
                  );
                })}
                {partStats.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-400">파트별 데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'staff' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left text-xs uppercase tracking-wide">
                  <th className="pb-4 font-semibold">이름</th>
                  <th className="pb-4 font-semibold">파트</th>
                  <th className="pb-4 font-semibold">응시 횟수</th>
                  <th className="pb-4 font-semibold">최근 점수</th>
                  <th className="pb-4 font-semibold">평균 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map(s => {
                  const sr = results.filter(r => r.staffId === s.id);
                  if (sr.length === 0) return null;
                  const avg = Math.round(sr.reduce((acc, r) => acc + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / sr.length);
                  const latest = sr.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-semibold text-gray-900">{s.name}</td>
                      <td className="py-3 text-gray-500">{parts.find(p => p.id === s.partId)?.name ?? '-'}</td>
                      <td className="py-3"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">{sr.length}회</span></td>
                      <td className="py-3 font-medium">{latest.totalScore}<span className="text-gray-400">/{latest.maxScore}</span></td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${avg}%` }} />
                          </div>
                          <span className="font-semibold text-gray-700">{avg}점</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'question' && selectedExam && (
            <QuestionStats examId={selectedExamId} results={filteredResults} />
          )}
          {activeTab === 'question' && !selectedExam && (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-400">상단에서 시험을 선택해주세요.</p>
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
    if (!examId) return;
    import('@/lib/firestore').then(({ getQuestions }) => getQuestions(examId)).then(setQuestions);
  }, [examId]);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-400 text-left text-xs uppercase tracking-wide">
          <th className="pb-4 font-semibold">번호</th>
          <th className="pb-4 font-semibold">문항</th>
          <th className="pb-4 font-semibold">정답률</th>
          <th className="pb-4 font-semibold">정답/전체</th>
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
                  <div className="w-28 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-2.5 rounded-full transition-all duration-700 ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-orange-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`font-semibold text-sm ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-orange-500' : 'text-red-500'}`}>{pct}%</span>
                </div>
              </td>
              <td className="py-3 text-gray-500">{correct}<span className="text-gray-300">/{total}</span></td>
            </tr>
          );
        })}
        {questions.length === 0 && (
          <tr><td colSpan={4} className="py-12 text-center text-gray-400">문항 데이터를 불러오는 중...</td></tr>
        )}
      </tbody>
    </table>
  );
}
