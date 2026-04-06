import { LogOut, UserRound } from 'lucide-react';
import { useStorage } from '../utils';
import { signOutUser } from '../auth-service';

function providerLabel(provider) {
  if (provider === 'kakao') return '카카오';
  if (provider === 'google') return 'Google';
  if (provider === 'email') return '이메일';
  return '기본';
}

export default function SettingsView({ onLogout }) {
  const [currentUser, setCurrentUser] = useStorage('currentUser', null);
  const safeCurrentUser = currentUser && typeof currentUser === 'object' ? currentUser : {};

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    if (onLogout) onLogout();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-6">
      <div className="glass-panel rounded-[30px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(180deg,#f8fbff,#e8f1ff)] text-sky-600 shadow-inner">
            <UserRound size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{safeCurrentUser?.name || '사용자'}</p>
            <span className="apple-chip mt-1 inline-flex text-[10px]">
              {providerLabel(safeCurrentUser?.provider)} 계정
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">표시 이름</label>
            <input
              type="text"
              value={safeCurrentUser?.name || ''}
              onChange={(e) => setCurrentUser({ ...safeCurrentUser, name: e.target.value })}
              className="apple-input"
              placeholder="내 별명"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">이메일</label>
            <input
              type="email"
              value={safeCurrentUser?.email || ''}
              onChange={(e) => setCurrentUser({ ...safeCurrentUser, email: e.target.value })}
              className="apple-input"
              placeholder="example@email.com"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(244,63,94,0.2)] transition hover:bg-rose-600"
        >
          <LogOut size={16} /> 로그아웃
        </button>
      </div>
    </div>
  );
}
