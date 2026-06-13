'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveAdminSession } from '@/lib/session';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetSending, setResetSending] = useState(false);

  async function handleLogin() {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      saveAdminSession();
      router.push('/admin/dashboard');
    } else {
      setError('비밀번호가 올바르지 않습니다.');
    }
  }

  async function handleResetPassword() {
    if (!resetEmail) { setResetMsg('이메일을 입력해주세요.'); return; }
    setResetSending(true);
    setResetMsg('');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMsg('비밀번호 재설정 이메일이 발송되었습니다. 받은 편지함을 확인해주세요.');
    } catch {
      setResetMsg('이메일 발송에 실패했습니다. 이메일 주소를 확인해주세요.');
    }
    setResetSending(false);
  }

  if (showForgot) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
          <button onClick={() => { setShowForgot(false); setResetMsg(''); setResetEmail(''); }}
            className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 text-sm">
            ← 로그인으로 돌아가기
          </button>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">비밀번호 찾기</h2>
            <p className="text-gray-500 text-sm mt-2">관리자 이메일로 재설정 링크를 발송합니다</p>
          </div>
          <div className="space-y-4">
            <input
              type="email"
              value={resetEmail}
              onChange={e => { setResetEmail(e.target.value); setResetMsg(''); }}
              onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
              placeholder="관리자 이메일 주소"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {resetMsg && (
              <p className={`text-sm rounded-lg px-3 py-2 ${resetMsg.includes('발송되었습니다') ? 'text-green-700 bg-green-50' : 'text-red-500 bg-red-50'}`}>
                {resetMsg}
              </p>
            )}
            <button
              onClick={handleResetPassword}
              disabled={resetSending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg py-3 font-semibold transition-colors"
            >
              {resetSending ? '발송 중...' : '재설정 이메일 발송'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 text-sm">
          ← 돌아가기
        </button>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-800 rounded-xl mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">관리자 로그인</h2>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="비밀번호"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white rounded-lg py-3 font-semibold transition-colors"
          >
            로그인
          </button>
          <button
            onClick={() => setShowForgot(true)}
            className="w-full text-gray-400 hover:text-gray-600 text-sm py-1 transition-colors"
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>
      </div>
    </div>
  );
}
