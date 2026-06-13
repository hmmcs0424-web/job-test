'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function AdminSettings() {
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Password change via API
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  async function handleSendEmail() {
    setSending(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'hmmcs.0424@gmail.com');
      setEmailSent(true);
    } catch {
      setError('이메일 발송에 실패했습니다. 관리자 이메일을 확인해주세요.');
    }
    setSending(false);
  }

  async function handleChangePassword() {
    if (!currentPw || !newPw || !confirmPw) { setPwMsg('모든 항목을 입력해주세요.'); return; }
    if (newPw !== confirmPw) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    if (newPw.length < 6) { setPwMsg('비밀번호는 6자 이상이어야 합니다.'); return; }
    setPwSaving(true);

    const verifyRes = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: currentPw }),
    });

    if (!verifyRes.ok) {
      setPwMsg('현재 비밀번호가 올바르지 않습니다.');
      setPwSaving(false);
      return;
    }

    const changeRes = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPw }),
    });

    if (changeRes.ok) {
      setPwMsg('비밀번호가 변경되었습니다.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } else {
      setPwMsg('비밀번호 변경에 실패했습니다.');
    }
    setPwSaving(false);
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>

      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="font-bold text-gray-800 mb-4">비밀번호 변경</h2>
        <div className="space-y-3">
          <input type="password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwMsg(''); }}
            placeholder="현재 비밀번호"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setPwMsg(''); }}
            placeholder="새 비밀번호 (6자 이상)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwMsg(''); }}
            placeholder="새 비밀번호 확인"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {pwMsg && (
            <p className={`text-sm ${pwMsg.includes('변경되었습니다') ? 'text-green-600' : 'text-red-500'}`}>{pwMsg}</p>
          )}
          <button onClick={handleChangePassword} disabled={pwSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-lg font-semibold">
            {pwSaving ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-bold text-gray-800 mb-2">Firebase 이메일 인증으로 비밀번호 재설정</h2>
        <p className="text-sm text-gray-500 mb-4">
          관리자 이메일(hmmcs.0424@gmail.com)로 비밀번호 재설정 이메일을 발송합니다.
        </p>
        {emailSent ? (
          <div className="bg-green-50 text-green-700 rounded-lg px-4 py-3 text-sm">
            ✅ 이메일이 발송되었습니다. 받은 편지함을 확인해주세요.
          </div>
        ) : (
          <button onClick={handleSendEmail} disabled={sending}
            className="w-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold">
            {sending ? '발송 중...' : '재설정 이메일 발송'}
          </button>
        )}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    </div>
  );
}
