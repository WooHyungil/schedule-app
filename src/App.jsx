import { useEffect, useState } from 'react';
import { Calendar, Repeat2, CheckCircle2, Settings, Wallet, Download } from 'lucide-react';
import CalendarView from './components/CalendarView';
import DailyView from './components/DailyView';
import TodoView from './components/TodoView';
import SettingsView from './components/SettingsView';
import FinanceView from './components/FinanceView';
import OnboardingView from './components/OnboardingView';
import { useCloudSync } from './hooks/useCloudSync';
import { useStorage } from './utils';

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [events] = useStorage('events', []);
  const [notificationSettings] = useStorage('notificationSettings', { enabled: false, defaultReminderMinutes: 10 });
  const [currentUser, setCurrentUser] = useStorage('currentUser', null);
  const [shareConnections] = useStorage('shareConnections', []);
  const syncState = useCloudSync();

  useEffect(() => {
    if (!notificationSettings?.enabled) return;
    if (typeof window === 'undefined' || !("Notification" in window)) return;
    if (Notification.permission !== 'granted') return;

    const maxTimeout = 2147483647;
    window.__scheduleReminderTimers = window.__scheduleReminderTimers || new Map();
    const timers = window.__scheduleReminderTimers;

    timers.forEach((timerId) => window.clearTimeout(timerId));
    timers.clear();

    const now = Date.now();

    events.forEach((evt) => {
      if (!evt?.showTime) return;
      const reminderMinutes = Number(evt?.reminderMinutes || 0);
      if (!reminderMinutes) return;

      const startMs = new Date(evt.startDate).getTime();
      if (Number.isNaN(startMs)) return;

      const triggerMs = startMs - reminderMinutes * 60 * 1000;
      const delay = triggerMs - now;

      if (delay <= 0 || delay > maxTimeout) return;

      const key = `${evt.id}-${startMs}-${reminderMinutes}`;
      const timerId = window.setTimeout(() => {
        new Notification('일정 알림', {
          body: `${evt.title} · ${reminderMinutes}분 전입니다`,
          icon: '/icon-192.svg',
          tag: 'schedule-reminder',
          requireInteraction: false,
        });
        timers.delete(key);
      }, delay);

      timers.set(key, timerId);
    });

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, [events, notificationSettings?.enabled]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const onAppInstalled = () => setInstallPrompt(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (!currentUser?.uid) {
    return <OnboardingView onComplete={setCurrentUser} />;
  }

  const myNickname = (currentUser?.name || '').trim() || '나';
  const partnerNicknames = Array.from(
    new Set(
      (shareConnections || [])
        .map((item) => (item?.nickname || '').trim())
        .filter(Boolean)
    )
  );
  const titleNames = partnerNicknames.length > 0 ? [myNickname, ...partnerNicknames] : [myNickname];
  const appTitle = titleNames.length > 1 ? `${titleNames.join('&')}의 스케줄` : `스케줄`;

  const tabs = [
    { icon: Calendar, label: '달력', component: CalendarView },
    { icon: Repeat2, label: '데일리', component: DailyView },
    { icon: CheckCircle2, label: '할일', component: TodoView },
    { icon: Wallet, label: '가계부', component: FinanceView },
    { icon: Settings, label: '설정', component: SettingsView },
  ];

  const CurrentComponent = tabs[activeTab].component;
  const syncLabel =
    syncState.status === 'online'
      ? '클라우드 연결됨'
      : syncState.status === 'syncing'
        ? '동기화 중'
        : syncState.status === 'connecting'
          ? '연결 중'
          : syncState.status === 'error'
            ? '동기화 오류'
            : '로컬 모드';
  const syncTone =
    syncState.status === 'online'
      ? 'bg-emerald-100 text-emerald-700'
      : syncState.status === 'error'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-sky-100 text-sky-700';

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-slate-800">{appTitle}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
              <span className={`rounded-full px-2 py-1 font-semibold ${syncTone}`}>{syncLabel}</span>
              {syncState.lastSyncedAt && <span>최근 반영 {new Date(syncState.lastSyncedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {installPrompt && (
              <button
                type="button"
                onClick={installApp}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-xs text-white transition-colors hover:bg-indigo-700"
              >
                <Download size={12} /> 앱 설치
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 font-medium">{currentUser.name}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-3 pt-3 sm:px-4">
        <div className="overflow-hidden rounded-[28px] border border-white/60 bg-white/35 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.68),rgba(255,255,255,0.88))]">
            <div className="px-4 pb-2 pt-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-white px-2.5 py-1 font-medium shadow-sm">일정</span>
                <span className="rounded-full bg-white px-2.5 py-1 font-medium shadow-sm">데일리</span>
                <span className="rounded-full bg-white px-2.5 py-1 font-medium shadow-sm">가계부</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 pt-2">
        {activeTab === 4 ? <CurrentComponent onLogout={() => setCurrentUser(null)} /> : <CurrentComponent />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/10 to-transparent px-3 pt-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-4xl gap-1.5 rounded-3xl border border-white/70 bg-white/82 p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`flex-1 py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                  activeTab === index
                    ? 'text-sky-700 bg-gradient-to-b from-sky-100 to-sky-50 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <Icon size={20} />
                <span className="text-[11px] font-semibold tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
