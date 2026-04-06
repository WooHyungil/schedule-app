import { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, LogOut, Mail, Plus, Trash2, UserRound, Users, Check, AlertCircle, Globe, Copy } from 'lucide-react';
import { useStorage } from '../utils';
import { signOutUser } from '../auth-service';

function providerLabel(provider) {
  if (provider === 'kakao') return '카카오';
  if (provider === 'google') return 'Google';
  if (provider === 'email') return '이메일';
  return '기본';
}

export default function SettingsView({ onLogout }) {
  const [events] = useStorage('events', []);
  const [expenses] = useStorage('expenses', []);
  const [dailyTemplates] = useStorage('dailyTemplates', []);
  const [syncMode, setSyncMode] = useStorage('syncMode', 'global');
  const [globalShareCode, setGlobalShareCode] = useStorage('globalShareCode', '');

  const [currentUser, setCurrentUser] = useStorage('currentUser', null);
  const [shareConnections, setShareConnections] = useStorage('shareConnections', []);
  const [shareOptions, setShareOptions] = useStorage('shareOptions', {
    events: true,
    expenses: true,
    daily: true,
  });
  const [notificationSettings, setNotificationSettings] = useStorage('notificationSettings', {
    enabled: false,
    defaultReminderMinutes: 10,
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNickname, setInviteNickname] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  const defaultGlobalCode = useMemo(() => {
    const seed = String(currentUser?.uid || '')
      .replace(/^local_/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 18);
    return seed || 'team-main';
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!globalShareCode && defaultGlobalCode) {
      setGlobalShareCode(defaultGlobalCode);
    }
  }, [defaultGlobalCode, globalShareCode, setGlobalShareCode]);

  const sharedSummary = useMemo(() => {
    const eventCount = events.length;
    const dailyCount = dailyTemplates.length;
    const expenseCount = expenses.length;
    const expenseTotal = expenses
      .filter((item) => item.type !== 'income')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { eventCount, dailyCount, expenseCount, expenseTotal };
  }, [events, dailyTemplates, expenses]);

  const addConnection = () => {
    setInviteError('');
    const email = inviteEmail.trim().toLowerCase();
    const nickname = inviteNickname.trim();

    if (!email) {
      setInviteError('이메일을 입력해주세요.');
      return;
    }
    if (!nickname) {
      setInviteError('표시 이름을 입력해주세요.');
      return;
    }
    if (!email.includes('@')) {
      setInviteError('유효한 이메일 형식을 입력해주세요.');
      return;
    }
    if (shareConnections.some((item) => item.email === email)) {
      setInviteError('이미 추가된 이메일입니다.');
      return;
    }
    if (email === currentUser?.email) {
      setInviteError('자신의 이메일로는 공유할 수 없습니다.');
      return;
    }

    setShareConnections([
      {
        id: Date.now().toString(36),
        email,
        nickname,
        status: 'invited', // 'invited', 'accepted', 'pending'
        createdAt: new Date().toISOString(),
      },
      ...shareConnections,
    ]);

    setInviteEmail('');
    setInviteNickname('');
  };

  const removeConnection = (id) => {
    setShareConnections(shareConnections.filter((item) => item.id !== id));
  };

  const updateNickname = (id, nickname) => {
    setShareConnections(
      shareConnections.map((item) => (item.id === id ? { ...item, nickname } : item))
    );
  };

  const requestPushPermission = async () => {
    if (!("Notification" in window)) {
      alert('이 브라우저는 알림 기능을 지원하지 않습니다.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationSettings({ ...notificationSettings, enabled: permission === 'granted' });

    if (permission !== 'granted') {
      alert('알림 권한이 거부되어 푸시 알림을 보낼 수 없습니다.');
    }
  };

  const toggleShareOption = (key) => {
    setShareOptions({ ...shareOptions, [key]: !shareOptions[key] });
  };

  const handleLogout = async () => {
    await signOutUser();
    setCurrentUser(null);
    if (onLogout) onLogout();
  };

  const copyCode = async () => {
    const value = String(globalShareCode || '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto pb-6 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 backdrop-blur-sm rounded-2xl border border-sky-200/50 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">앱 설정</h2>
        <p className="text-sm text-slate-600">내 계정, 공유, 알림을 관리하세요</p>
      </div>

      {/* Account Section */}
      <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-sm border border-white/70 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600 flex items-center justify-center">
            <UserRound size={24} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg text-slate-900">{currentUser?.name || '사용자'}</p>
            <span className="inline-flex text-[10px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold mt-1">
              {providerLabel(currentUser?.provider)} 계정
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">표시 이름</label>
            <input
              type="text"
              value={currentUser?.name || ''}
              onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
              placeholder="내 별명"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">이메일</label>
            <input
              type="email"
              value={currentUser?.email || ''}
              onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
              placeholder="example@email.com"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-all active:scale-95"
        >
          <LogOut size={16} /> 로그아웃
        </button>
      </div>

      <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-sm border border-white/70 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
            <Globe size={20} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">연동 모드</p>
            <p className="text-xs text-slate-500">글로벌 모드에서 다른 사람과 실시간 공유</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setSyncMode('personal')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border-2 transition ${
              syncMode === 'personal'
                ? 'border-slate-800 bg-slate-900 text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            개인 모드
          </button>
          <button
            type="button"
            onClick={() => setSyncMode('global')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border-2 transition ${
              syncMode === 'global'
                ? 'border-cyan-500 bg-cyan-500 text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            글로벌 모드
          </button>
        </div>

        {syncMode === 'global' && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
            <label className="block text-xs font-semibold text-slate-600 mb-2">글로벌 공유 코드</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={globalShareCode}
                onChange={(e) => setGlobalShareCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="예: team-main"
                className="flex-1 px-3 py-2.5 rounded-lg border border-cyan-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={copyCode}
                className="px-3 py-2.5 rounded-lg border border-cyan-300 text-cyan-700 bg-white hover:bg-cyan-50 text-sm font-semibold inline-flex items-center gap-1"
              >
                <Copy size={14} /> {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              같은 코드를 입력한 사용자끼리 동일한 일정/데이터가 실시간으로 연동됩니다.
            </p>
          </div>
        )}
      </div>

      {/* Notification Section */}
      <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-sm border border-white/70 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <p className="font-semibold text-slate-900">푸시 알림</p>
              <p className="text-xs text-slate-500">일정 미리알림</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${notificationSettings.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {notificationSettings.enabled ? '활성화' : '비활성화'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          <button
            type="button"
            onClick={requestPushPermission}
            className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-all active:scale-95"
          >
            권한 허용
          </button>
          <button
            type="button"
            onClick={() => setNotificationSettings({ ...notificationSettings, enabled: !notificationSettings.enabled })}
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-all"
          >
            {notificationSettings.enabled ? '끄기' : '켜기'}
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">기본 알림 시간</p>
          <div className="grid grid-cols-3 gap-2">
            {[0, 10, 30].map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => setNotificationSettings({ ...notificationSettings, defaultReminderMinutes: min })}
                className={`px-3 py-2 text-xs rounded-lg border-2 font-bold transition-all ${
                  Number(notificationSettings.defaultReminderMinutes) === min
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {min === 0 ? '없음' : `${min}분 전`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Share Section */}
      <div className="bg-white/85 backdrop-blur-sm rounded-2xl shadow-sm border border-white/70 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">일정 공유</p>
            <p className="text-xs text-slate-500">다른 사람과 일정을 공유하세요</p>
          </div>
        </div>

        {/* Share Invite Section */}
        <div className="mb-6 p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/50">
          <p className="text-sm font-semibold text-slate-900 mb-3">사용자 초대</p>
          <div className="space-y-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">이메일</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError('');
                }}
                placeholder="friend@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-emerald-200 bg-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">표시 이름</label>
              <input
                type="text"
                value={inviteNickname}
                onChange={(e) => {
                  setInviteNickname(e.target.value);
                  setInviteError('');
                }}
                placeholder="친구의 이름"
                className="w-full px-4 py-2.5 rounded-lg border border-emerald-200 bg-white text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
          </div>

          {inviteError && (
            <div className="mb-3 flex items-start gap-2 p-3 bg-rose-50 rounded-lg border border-rose-200">
              <AlertCircle size={14} className="text-rose-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-rose-700">{inviteError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={addConnection}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold rounded-lg hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> 초대하기
          </button>
        </div>

        {/* Share Options */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-900 mb-3">공유 항목</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { key: 'events', label: '📅 일정', color: 'sky' },
              { key: 'daily', label: '📝 데일리', color: 'indigo' },
              { key: 'expenses', label: '💰 지출', color: 'amber' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleShareOption(item.key)}
                className={`p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                  shareOptions[item.key]
                    ? `border-${item.color}-300 bg-${item.color}-50 text-${item.color}-700`
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                {shareOptions[item.key] ? <Check className="inline mr-1" size={14} /> : '○'} {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shared Summary */}
        <div className="mb-6 p-4 bg-slate-50/50 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">공유 통계</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
              <p className="font-bold text-slate-900 text-base">{sharedSummary.eventCount}</p>
              <p className="text-slate-500">일정</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
              <p className="font-bold text-slate-900 text-base">{sharedSummary.dailyCount}</p>
              <p className="text-slate-500">데일리</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
              <p className="font-bold text-slate-900 text-base">{sharedSummary.expenseCount}</p>
              <p className="text-slate-500">지출</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 text-center">
              <p className="font-bold text-slate-900">{(sharedSummary.expenseTotal / 10000).toFixed(1)}만</p>
              <p className="text-slate-500">원</p>
            </div>
          </div>
        </div>

        {/* Connections List */}
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-3">
            공유 대상 {shareConnections.length > 0 && <span className="text-slate-400 font-normal text-xs ml-2">({shareConnections.length}명)</span>}
          </p>

          {shareConnections.length === 0 ? (
            <div className="text-center py-6 px-4 bg-slate-50/50 rounded-lg border border-slate-200 border-dashed">
              <Users size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">아직 공유 대상이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {shareConnections.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Check size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-500 truncate">{item.email}</p>
                    <input
                      type="text"
                      value={item.nickname}
                      onChange={(e) => updateNickname(item.id, e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100 transition"
                      placeholder="이름 입력"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeConnection(item.id)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                    aria-label="공유 제거"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg">
          💡 공유된 데이터는 Firebase에 안전하게 저장되며, 공유 대상이 같은 이메일로 로그인하면 자동으로 동기화됩니다.
        </p>
      </div>
    </div>
  );
}
