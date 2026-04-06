import { useMemo } from 'react';
import { useStorage, formatDate, appliesTemplateOnDate } from '../utils';

export default function YearlyView({ selectedYear }) {
  const [events] = useStorage('events', []);
  const [dailyTemplates] = useStorage('dailyTemplates', []);
  const [dailyCompletionMap] = useStorage('dailyCompletionMap', {});

  const yearSummary = useMemo(() => {
    let total = 0;
    let completed = 0;
    const dayMap = new Map();

    for (let month = 0; month < 12; month += 1) {
      const lastDay = new Date(selectedYear, month + 1, 0).getDate();
      for (let day = 1; day <= lastDay; day += 1) {
        const date = new Date(selectedYear, month, day);
        const key = formatDate(date);

        const normalEvents = events.filter((e) => formatDate(e.startDate) === key);
        const dailyEvents = dailyTemplates.filter((t) => appliesTemplateOnDate(t, date));

        const dayTotal = normalEvents.length + dailyEvents.length;
        const dayCompleted =
          normalEvents.filter((e) => e.isCompleted).length +
          dailyEvents.filter((t) => dailyCompletionMap[`${t.id}_${key}`]).length;

        if (dayTotal > 0) {
          dayMap.set(key, { total: dayTotal, completed: dayCompleted, ratio: dayCompleted / dayTotal });
        }

        total += dayTotal;
        completed += dayCompleted;
      }
    }

    return { total, completed, ratio: total > 0 ? completed / total : 0, dayMap };
  }, [selectedYear, events, dailyTemplates, dailyCompletionMap]);

  const getHeatColor = (ratio) => {
    if (ratio >= 1) return 'bg-emerald-500';
    if (ratio >= 0.7) return 'bg-emerald-400';
    if (ratio >= 0.4) return 'bg-amber-300';
    if (ratio > 0) return 'bg-rose-300';
    return 'bg-slate-100';
  };

  const completionRate = Math.round(yearSummary.ratio * 100);

  return (
    <div className="p-4 max-w-4xl mx-auto pb-6 space-y-4">
      {/* 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">연간 수행 현황</h2>
            <p className="text-xs text-slate-500 mt-0.5">일정 완료율을 한눈에 확인하세요</p>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-[11px] text-slate-500 font-medium">전체 일정</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{yearSummary.total}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[11px] text-emerald-600 font-medium">완료</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{yearSummary.completed}</p>
          </div>
          <div className="rounded-xl bg-sky-50 border border-sky-100 p-3">
            <p className="text-[11px] text-sky-600 font-medium">수행률</p>
            <p className="text-2xl font-bold text-sky-700 mt-0.5">{completionRate}%</p>
          </div>
        </div>

        {/* 수행률 바 */}
        {yearSummary.total > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>0%</span>
              <span className="font-semibold text-slate-700">{completionRate}% 달성</span>
              <span>100%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 히트맵 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-4">{selectedYear}년 달력 히트맵</h3>

        <div className="space-y-2">
          {[...Array(12)].map((_, month) => {
            const days = new Date(selectedYear, month + 1, 0).getDate();
            return (
              <div key={month} className="grid items-center gap-2" style={{ gridTemplateColumns: '28px 1fr' }}>
                <span className="text-[11px] text-slate-400 font-medium text-right">{month + 1}월</span>
                <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
                  {[...Array(days)].map((__, dayIndex) => {
                    const day = dayIndex + 1;
                    const key = formatDate(new Date(selectedYear, month, day));
                    const meta = yearSummary.dayMap.get(key);
                    return (
                      <div
                        key={key}
                        title={`${key} · ${meta ? `완료 ${meta.completed}/${meta.total}` : '일정 없음'}`}
                        className={`h-3 rounded-sm ${getHeatColor(meta?.ratio || 0)}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
          <span>낮음</span>
          <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
          <span className="w-3 h-3 rounded-sm bg-rose-300" />
          <span className="w-3 h-3 rounded-sm bg-amber-300" />
          <span className="w-3 h-3 rounded-sm bg-emerald-400" />
          <span className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span>높음</span>
        </div>
      </div>
    </div>
  );
}
