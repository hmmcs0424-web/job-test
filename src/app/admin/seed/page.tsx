'use client';

import { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * 테스트 데이터 시드 페이지
 * 파트 5개 + 파트별 상담사 1명 + 시험 2개 + 각 시험 결과 생성
 * 실제 운영 전 삭제하거나 접근을 제한하세요.
 */

const TEST_PARTS = [
  { name: '콜지원파트', order: 1 },
  { name: '민원관리파트', order: 2 },
  { name: '신입교육파트', order: 3 },
  { name: '운영관리파트', order: 4 },
  { name: '품질관리파트', order: 5 },
];

const TEST_STAFF = [
  { name: '김민준', employeeId: 'EMP001', partIndex: 0 },
  { name: '이서연', employeeId: 'EMP002', partIndex: 1 },
  { name: '박지훈', employeeId: 'EMP003', partIndex: 2 },
  { name: '최수아', employeeId: 'EMP004', partIndex: 3 },
  { name: '정도현', employeeId: 'EMP005', partIndex: 4 },
];

// 파트별 점수 (시험1, 시험2) — 점수를 다양하게 설정
const SCORES_EXAM1 = [100, 85, 72, 90, 55];  // partIndex 순
const SCORES_EXAM2 = [88, 76, 95, 68, 82];

export default function SeedPage() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  function addLog(msg: string) {
    setLog(prev => [...prev, msg]);
  }

  async function runSeed() {
    if (!confirm('테스트 데이터를 생성하시겠습니까?\n기존 데이터와 중복될 수 있습니다.')) return;
    setRunning(true);
    setLog([]);

    try {
      // 1. 파트 생성
      addLog('── 파트 생성 중...');
      const partIds: string[] = [];
      for (const p of TEST_PARTS) {
        const ref = await addDoc(collection(db, 'parts'), { ...p, createdAt: new Date().toISOString() });
        partIds.push(ref.id);
        addLog(`  ✓ 파트: ${p.name} (${ref.id})`);
      }

      // 2. 상담사 생성
      addLog('── 상담사 생성 중...');
      const staffIds: string[] = [];
      for (const s of TEST_STAFF) {
        const ref = await addDoc(collection(db, 'staff'), {
          name: s.name,
          employeeId: s.employeeId,
          partId: partIds[s.partIndex],
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        staffIds.push(ref.id);
        addLog(`  ✓ 상담사: ${s.name} / ${TEST_PARTS[s.partIndex].name}`);
      }

      // 3. 시험 2개 생성
      addLog('── 시험 생성 중...');
      const now = new Date();
      const exam1Data = {
        title: '[테스트] 2026년 5월 직무테스트',
        type: '월별 직무테스트',
        targetParts: partIds,
        targetStaffIds: staffIds,
        absentReasons: {},
        status: 'closed',
        timeLimit: 30,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        questionCount: 10,
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const exam2Data = {
        title: '[테스트] 2026년 6월 직무테스트',
        type: '월별 직무테스트',
        targetParts: partIds,
        targetStaffIds: staffIds,
        absentReasons: {},
        status: 'active',
        timeLimit: 30,
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        questionCount: 10,
        createdAt: now.toISOString(),
      };
      const exam1Ref = await addDoc(collection(db, 'exams'), exam1Data);
      addLog(`  ✓ 시험1: ${exam1Data.title} (${exam1Ref.id})`);
      const exam2Ref = await addDoc(collection(db, 'exams'), exam2Data);
      addLog(`  ✓ 시험2: ${exam2Data.title} (${exam2Ref.id})`);

      // 4. 결과 생성 (각 시험 × 5명)
      addLog('── 응시 결과 생성 중...');

      for (let i = 0; i < TEST_STAFF.length; i++) {
        const s = TEST_STAFF[i];
        const partId = partIds[s.partIndex];

        // 시험1 결과
        const score1 = SCORES_EXAM1[i];
        await addDoc(collection(db, 'results'), {
          examId: exam1Ref.id,
          examTitle: exam1Data.title,
          staffId: staffIds[i],
          staffName: s.name,
          staffEmployeeId: s.employeeId,
          partId,
          startedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          submittedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
          answers: {},
          totalScore: score1,
          maxScore: 100,
          passed: score1 >= 60,
          editHistory: [],
        });
        addLog(`  ✓ 시험1 결과: ${s.name} → ${score1}점`);

        // 시험2 결과
        const score2 = SCORES_EXAM2[i];
        await addDoc(collection(db, 'results'), {
          examId: exam2Ref.id,
          examTitle: exam2Data.title,
          staffId: staffIds[i],
          staffName: s.name,
          staffEmployeeId: s.employeeId,
          partId,
          startedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          submittedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 18 * 60 * 1000).toISOString(),
          answers: {},
          totalScore: score2,
          maxScore: 100,
          passed: score2 >= 60,
          editHistory: [],
        });
        addLog(`  ✓ 시험2 결과: ${s.name} → ${score2}점`);
      }

      addLog('');
      addLog('✅ 테스트 데이터 생성 완료!');
      addLog('대시보드에서 [테스트] 시험을 선택하면 그래프를 확인할 수 있습니다.');
      setDone(true);
    } catch (e: any) {
      addLog(`❌ 오류: ${e.message}`);
    }
    setRunning(false);
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">테스트 데이터 생성</h1>
      <p className="text-sm text-gray-500 mb-6">
        대시보드 그래프 확인용 임시 데이터를 생성합니다. 테스트 후 불필요한 데이터는 직접 삭제하세요.
      </p>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-800">
        <p className="font-semibold mb-1">생성될 데이터</p>
        <ul className="list-disc list-inside space-y-0.5 text-yellow-700">
          <li>파트 5개 (콜지원파트, 민원관리파트, 신입교육파트, 운영관리파트, 품질관리파트)</li>
          <li>파트별 상담사 1명씩 (총 5명)</li>
          <li>시험 2개 ([테스트] 5월 직무테스트, [테스트] 6월 직무테스트)</li>
          <li>각 시험별 응시 결과 5건 (다양한 점수)</li>
        </ul>
      </div>

      <button
        onClick={runSeed}
        disabled={running || done}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-semibold mb-6 transition-colors">
        {running ? '생성 중...' : done ? '✓ 완료' : '테스트 데이터 생성'}
      </button>

      {log.length > 0 && (
        <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-xs space-y-0.5 max-h-96 overflow-y-auto">
          {log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      )}

      {done && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          생성 완료! <a href="/admin/dashboard" className="font-semibold underline">대시보드로 이동</a>해서 [테스트] 시험을 선택하세요.
        </div>
      )}
    </div>
  );
}
