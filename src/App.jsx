import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Repeat2, CheckCircle2, Settings, Wallet, Download } from 'lucide-react';
import OnboardingView from './components/OnboardingView';
import { useCloudSync } from './hooks/useCloudSync';
import { appStabilityAgent } from './services/appStabilityAgent';
import { useStorage } from './utils';

const loadCalendarView = () => import('./components/CalendarView');
const loadDailyView = () => import('./components/DailyView');
const loadTodoView = () => import('./components/TodoView');
const loadFinanceView = () => import('./components/FinanceView');
const loadSettingsView = () => import('./components/SettingsView');

const CalendarView = lazy(loadCalendarView);
const DailyView = lazy(loadDailyView);
const TodoView = lazy(loadTodoView);
const FinanceView = lazy(loadFinanceView);
const SettingsView = lazy(loadSettingsView);

function TabFallback() {
  return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-400">화면을 불러오는 중...</div>;
}

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Tab render error:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="glass-panel rounded-[24px] p-5 text-center">
          <p className="text-sm font-semibold text-slate-700">화면 로딩 중 오류가 발생했습니다.</p>
          <button
            type="button"
            onClick={this.props.onRecover}
            className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            달력으로 돌아가기
          </button>
        </div>
      </div>
    );
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [currentUser, setCurrentUser] = useStorage('currentUser', null);
  const syncState = useCloudSync();

  const contentRef = useRef(null);
  const pullStartYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullRafRef = useRef(null);
  const pullDistanceRef = useRef(0);
  const pullArmedRef = useRef(false);
  const pullCooldownRef = useRef(0);
  const pullEndTimerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullArmed, setPullArmed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullThreshold = 72;

  const resetPullState = useCallback(() => {
    if (pullRafRef.current) {
      window.cancelAnimationFrame(pullRafRef.current);
      pullRafRef.current = null;
    }
    pullingRef.current = false;
    pullDistanceRef.current = 0;
    pullArmedRef.current = false;
    setPullDistance(0);
    setPullArmed(false);
  }, []);

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    appStabilityAgent.sanitizeAllStorage();
    const stopMaintenance = appStabilityAgent.startBackgroundMaintenance();
    const stopGuards = appStabilityAgent.setupRuntimeGuards(() => {
      setActiveTab(0);
      setRefreshTick((prev) => prev + 1);
    });

    return () => {
      stopMaintenance();
      stopGuards();
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

  const appTitle = '스케줄';

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
  }, [setCurrentUser]);

  const tabs = useMemo(() => [
    { icon: Calendar, label: '달력', component: CalendarView },
    { icon: Repeat2, label: '데일리', component: DailyView },
    { icon: CheckCircle2, label: '할일', component: TodoView },
    { icon: Wallet, label: '가계부', component: FinanceView },
    { icon: Settings, label: '설정', component: SettingsView, componentProps: { onLogout: handleLogout } },
  ], [handleLogout]);

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

  const openTab = useCallback((index) => {
    if (index === activeTab) return;
    if (pullEndTimerRef.current) {
      window.clearTimeout(pullEndTimerRef.current);
      pullEndTimerRef.current = null;
    }
    setIsRefreshing(false);
    resetPullState();
    setActiveTab(index);
  }, [activeTab, resetPullState]);

  const triggerPullRefresh = useCallback(() => {
    const now = Date.now();
    if (now - pullCooldownRef.current < 1200) return;
    pullCooldownRef.current = now;

    if (pullEndTimerRef.current) {
      window.clearTimeout(pullEndTimerRef.current);
      pullEndTimerRef.current = null;
    }

    setIsRefreshing(true);
    setRefreshTick((prev) => prev + 1);
    pullEndTimerRef.current = window.setTimeout(() => {
      setIsRefreshing(false);
      pullEndTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    const scroller = contentRef.current;
    if (!scroller) return undefined;

    const commitPullState = (nextDistance) => {
      const nextArmed = nextDistance >= pullThreshold;

      if (Math.abs(nextDistance - pullDistanceRef.current) >= 4) {
        pullDistanceRef.current = nextDistance;
        setPullDistance(nextDistance);
      }

      if (nextArmed !== pullArmedRef.current) {
        pullArmedRef.current = nextArmed;
        setPullArmed(nextArmed);
      }
    };

    const onTouchStart = (event) => {
      if (isRefreshing) return;
      if (scroller.scrollTop > 0) return;
      pullStartYRef.current = event.touches?.[0]?.clientY || 0;
      pullingRef.current = true;
    };

    const onTouchMove = (event) => {
      if (!pullingRef.current || isRefreshing) return;
      if (scroller.scrollTop > 0) {
        resetPullState();
        return;
      }

      const currentY = event.touches?.[0]?.clientY || 0;
      const delta = currentY - pullStartYRef.current;

      if (delta <= 0) {
        commitPullState(0);
        return;
      }

      if (event.cancelable) event.preventDefault();

      const nextDistance = Math.min(112, delta * 0.5);
      if (pullRafRef.current) return;

      pullRafRef.current = window.requestAnimationFrame(() => {
        pullRafRef.current = null;
        commitPullState(nextDistance);
      });
    };

    const onTouchEnd = () => {
      if (pullingRef.current && pullArmedRef.current && !isRefreshing) {
        triggerPullRefresh();
      }
      resetPullState();
    };

    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd, { passive: true });
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isRefreshing, pullThreshold, resetPullState, triggerPullRefresh]);

  useEffect(() => {
    return () => {
      if (pullEndTimerRef.current) {
        window.clearTimeout(pullEndTimerRef.current);
        pullEndTimerRef.current = null;
      }
    };
  }, []);

  const ActiveTabComponent = tabs[activeTab]?.component;
  const activeTabProps = tabs[activeTab]?.componentProps || {};

  return (
    <div className="app-shell relative flex min-h-screen flex-col overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,#dbeafe_0%,#dbeafe00_72%)]" />
        <div className="absolute -right-28 top-20 h-96 w-96 rounded-full bg-[radial-gradient(circle,#e2e8f0_0%,#e2e8f000_72%)]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#f8fafc_0%,#f8fafc00_75%)]" />
      </div>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
        <div className="glass-panel-strong mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-[30px] border border-white/70 px-4 py-3 shadow-[0_16px_32px_rgba(15,23,42,0.08)]" style={{ paddingTop: 'max(0.9rem, env(safe-area-inset-top))' }}>
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold tracking-[-0.04em] text-slate-950">{appTitle}</p>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
              <span className={`rounded-full px-2.5 py-1 font-semibold shadow-sm ${syncTone}`}>{syncLabel}</span>
              {syncState.lastSyncedAt && <span>최근 반영 {new Date(syncState.lastSyncedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {installPrompt && (
              <button
                type="button"
                onClick={installApp}
                className="apple-button px-3 py-2 text-xs"
              >
                <Download size={12} /> 앱 설치
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="apple-chip px-3 py-1.5 text-xs">{currentUser.name}</span>
            </div>
          </div>
        </div>
      </header>

      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto pb-28 pt-3"
        style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className="pointer-events-none mx-auto mb-1 flex max-w-5xl items-center justify-center"
          style={{
            height: pullDistance > 0 ? Math.min(48, pullDistance) : 0,
            opacity: pullDistance > 8 ? 1 : 0,
            transition: pullDistance > 0 ? 'none' : 'height 180ms ease, opacity 180ms ease',
          }}
        >
          <span className={`rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold shadow-sm ${pullArmed ? 'text-emerald-600' : 'text-slate-500'}`}>
            {isRefreshing ? '새로고침 중...' : pullArmed ? '놓으면 새로고침' : '아래로 당겨 새로고침'}
          </span>
        </div>
        <Suspense fallback={<TabFallback />}>
          <TabErrorBoundary resetKey={activeTab} onRecover={() => setActiveTab(0)}>
            {ActiveTabComponent ? <ActiveTabComponent key={`${activeTab}-${refreshTick}`} {...activeTabProps} /> : <TabFallback />}
          </TabErrorBoundary>
        </Suspense>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[120] bg-gradient-to-t from-slate-900/10 via-slate-900/2 to-transparent px-3 pt-2" style={{ paddingBottom: 'calc(0.8rem + env(safe-area-inset-bottom))' }}>
        <div className="glass-panel-strong mx-auto flex max-w-5xl gap-1.5 rounded-[30px] border border-white/70 p-1.5 shadow-[0_20px_44px_rgba(15,23,42,0.12)]">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={index}
                onClick={() => openTab(index)}
                onTouchStart={() => openTab(index)}
                className={`flex-1 rounded-[22px] px-2 py-3.5 flex flex-col items-center justify-center gap-1 transition-all duration-200 relative ${
                  activeTab === index
                    ? 'text-slate-950 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${activeTab === index ? 'bg-sky-50 text-sky-600' : 'bg-transparent'}`}>
                  <Icon size={19} />
                </div>
                <span className="text-[11px] font-semibold tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
