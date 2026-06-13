'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAdminSession } from '@/lib/session';

const navItems = [
  { href: '/admin/dashboard', label: '대시보드', icon: '📊' },
  { href: '/admin/exams', label: '시험 관리', icon: '📝' },
  { href: '/admin/staff', label: '인원 관리', icon: '👥' },
  { href: '/admin/results', label: '결과 관리', icon: '📋' },
  { href: '/admin/settings', label: '설정', icon: '⚙️' },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearAdminSession();
    router.push('/');
  }

  return (
    <nav className="bg-gray-900 text-white w-56 min-h-screen flex flex-col flex-shrink-0">
      <div className="p-5 border-b border-gray-700">
        <div className="font-bold text-lg">직무테스트</div>
        <div className="text-gray-400 text-xs mt-1">관리자 모드</div>
      </div>
      <div className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${pathname.startsWith(item.href) ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full text-gray-400 hover:text-white text-sm py-2 flex items-center gap-2 px-3"
        >
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </nav>
  );
}
