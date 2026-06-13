'use client';

import { useState, useEffect } from 'react';
import { getExams, getResults, getStaffList, getParts } from '@/lib/firestore';
import type { Exam, Result, Staff, Part } from '@/lib/types';

export default function AdminDashboard() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [activeTab, setActiveTab] = useState<'overall' | 'part' | 'staff' | 'question'>('overall');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getExams(), getResults(), getStaffList(), getParts()]).then(([e, r, s, p]) => {
      setExams(e);
      setResults(r);
      setStaff(s);
      setParts(p);
      if (e.length > 0) setSelectedExamId(e[0].id);
      setLoading(false);
    });
  }, []);

  const filteredResults = results.filter(r => !selectedExamId || r.examId === selectedExamId);
  const selectedExam = exams.find(e => e.id === selectedExamId);

  const totalCount = filteredResults.length;
  const passCount = filteredResults.filter(r => r.passed).length;
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
    return <div className="flex items-center justify-center h-full min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <select
          value={selectedExamId}
          onChange={e => setSelectedExamId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 시험</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: '응시 인원', value: `${totalCount}명`, color: 'blue' },
          { label: '합격 인원', value: `${passCount}명`, color: 'green' },
          { label: '합격률', value: `${totalCount > 0 ? Math.round(passCount / totalCount * 100) : 0}%`, color: 'purple' },
          { label: '평균 점수', value: `${avgScore}점`, color: 'orange' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-gray-500 text-sm mb-1">{card.label}</div>
            <div className="text-3xl font-bold text-gray-900">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex px-6">
            {[
              { key: 'overall', label: '전체 결과' },
              { key: 'part', label: '파트별' },
              { key: 'staff', label: '상담사별' },
              { key: 'question', label: '문항별' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-5 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overall' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pb-3 font-medium">이름</th>
                  <th className="pb-3 font-medium">사번</th>
                  <th className="pb-3 font-medium">파트</th>
                  <th className="pb-3 font-medium">점수</th>
                  <th className="pb-3 font-medium">결과</th>
                  <th className="pb-3 font-medium">제출 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredResults.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium">{r.staffName}</td>
                    <td className="py-3 text-gray-500">{r.staffEmployeeId}</td>
                    <td className="py-3 text-gray-500">{parts.find(p => p.id === r.partId)?.name ?? '-'}</td>
                    <td className="py-3">{r.totalScore}/{r.maxScore}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {r.passed ? '합격' : '불합격'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">{new Date(r.submittedAt).toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'part' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pb-3 font-medium">파트</th>
                  <th className="pb-3 font-medium">응시 인원</th>
                  <th className="pb-3 font-medium">합격 인원</th>
                  <th className="pb-3 font-medium">합격률</th>
                  <th className="pb-3 font-medium">평균 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partStats.map(ps => (
                  <tr key={ps.part.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium">{ps.part.name}</td>
                    <td className="py-3">{ps.count}명</td>
                    <td className="py-3">{ps.passCount}명</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${ps.count > 0 ? Math.round(ps.passCount / ps.count * 100) : 0}%` }}></div>
                        </div>
                        <span>{ps.count > 0 ? Math.round(ps.passCount / ps.count * 100) : 0}%</span>
                      </div>
                    </td>
                    <td className="py-3">{ps.avg}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'staff' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pb-3 font-medium">이름</th>
                  <th className="pb-3 font-medium">파트</th>
                  <th className="pb-3 font-medium">응시 횟수</th>
                  <th className="pb-3 font-medium">최근 점수</th>
                  <th className="pb-3 font-medium">평균 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map(s => {
                  const sr = results.filter(r => r.staffId === s.id);
                  if (sr.length === 0) return null;
                  const avg = Math.round(sr.reduce((acc, r) => acc + (r.maxScore > 0 ? (r.totalScore / r.maxScore) * 100 : 0), 0) / sr.length);
                  const latest = sr.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-3 font-medium">{s.name}</td>
                      <td className="py-3 text-gray-500">{parts.find(p => p.id === s.partId)?.name ?? '-'}</td>
                      <td className="py-3">{sr.length}회</td>
                      <td className="py-3">{latest.totalScore}/{latest.maxScore}</td>
                      <td className="py-3">{avg}점</td>
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
            <p className="text-gray-400 text-center py-8">시험을 선택해주세요.</p>
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
        <tr className="text-gray-500 text-left">
          <th className="pb-3 font-medium">번호</th>
          <th className="pb-3 font-medium">문항</th>
          <th className="pb-3 font-medium">정답률</th>
          <th className="pb-3 font-medium">정답 수</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {questions.map((q, idx) => {
          const total = results.length;
          const correct = results.filter(r => r.answers[q.id]?.isCorrect).length;
          const pct = total > 0 ? Math.round(correct / total * 100) : 0;
          return (
            <tr key={q.id} className="hover:bg-gray-50">
              <td className="py-3 text-gray-500">{idx + 1}</td>
              <td className="py-3 max-w-xs truncate">{q.content}</td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${pct >= 60 ? 'bg-blue-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <span>{pct}%</span>
                </div>
              </td>
              <td className="py-3">{correct}/{total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
