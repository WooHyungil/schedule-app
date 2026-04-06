import { useState, useMemo } from 'react';
import { useStorage, formatDate, appliesTemplateOnDate } from '../utils';

export default function TodoView() {
  const [events, setEvents] = useStorage('events', []);
  const [dailyTemplates] = useStorage('dailyTemplates', []);
  const [dailyCompletionMap, setDailyCompletionMap] = useStorage('dailyCompletionMap', {});
  const [showCompleted, setShowCompleted] = useState(true);
  const safeEvents = useMemo(() => {
    const src = Array.isArray(events) ? events : [];
    return src.filter((item) => item && typeof item === 'object' && item.id);
  }, [events]);
  const safeDailyTemplates = useMemo(() => {
    const src = Array.isArray(dailyTemplates) ? dailyTemplates : [];
    return src.filter((item) => item && typeof item === 'object' && item.id);
  }, [dailyTemplates]);
  const safeDailyCompletionMap = dailyCompletionMap && typeof dailyCompletionMap === 'object' ? dailyCompletionMap : {};

  const safeTime = (value) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '--:--';
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const today = formatDate(new Date()).split('T')[0];

  const todayTasks = useMemo(() => {
    const date = new Date(today);

    const normal = safeEvents
      .filter((event) => formatDate(event.startDate).split('T')[0] === today)
      .map((event) => ({ ...event, isDailyTemplate: false }));

    const daily = safeDailyTemplates
      .filter((template) => appliesTemplateOnDate(template, date))
      .map((template) => ({
        id: `daily-${template.id}-${today}`,
        templateId: template.id,
        title: template.title,
        description: template.description,
        startDate: new Date(`${today}T09:00`),
        endDate: new Date(`${today}T10:00`),
        isCompleted: Boolean(safeDailyCompletionMap[`${template.id}_${today}`]),
        isDailyTemplate: true,
      }));

    return [...daily, ...normal];
  }, [safeEvents, safeDailyTemplates, today, safeDailyCompletionMap]);

  const filteredTasks = showCompleted
    ? todayTasks
    : todayTasks.filter((task) => !task.isCompleted);

  const completionPercentage =
    todayTasks.length === 0 ? 0 : (todayTasks.filter((t) => t.isCompleted).length / todayTasks.length) * 100;

  const toggleCompletion = (task) => {
    if (task.isDailyTemplate) {
      const key = `${task.templateId}_${today}`;
      setDailyCompletionMap({
        ...safeDailyCompletionMap,
        [key]: !task.isCompleted,
      });
      return;
    }

    setEvents(
      safeEvents.map((event) =>
        event.id === task.id ? { ...event, isCompleted: !event.isCompleted } : event
      )
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-6">
      <div className="section-panel mb-4 p-5">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">진행률</span>
              <span className="text-lg font-bold text-sky-600">
                {Math.round(completionPercentage)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#4ba2ff,#0a84ff)] transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="soft-card rounded-[24px] p-4">
              <p className="text-sm text-slate-500">남은 작업</p>
              <p className="text-lg font-bold text-amber-600">
                {todayTasks.filter((t) => !t.isCompleted).length}개
              </p>
            </div>
            <div className="soft-card rounded-[24px] p-4">
              <p className="text-sm text-slate-500">완료됨</p>
              <p className="text-lg font-bold text-emerald-600">
                {todayTasks.filter((t) => t.isCompleted).length}개
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <input
            type="checkbox"
            id="showCompleted"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="h-4 w-4 rounded border-2 border-slate-300"
          />
          <label htmlFor="showCompleted" className="cursor-pointer text-sm font-medium text-slate-700">
            완료된 항목 표시
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="glass-panel rounded-[30px] p-10 text-center">
            <p className="text-lg font-medium text-slate-500">
              {showCompleted ? '오늘의 일정이 없습니다' : '모든 작업을 완료했습니다! 🎉'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="glass-panel flex items-start gap-3 rounded-[28px] p-4 transition-shadow hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
            >
              <button
                onClick={() => toggleCompletion(task)}
                className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  task.isCompleted
                    ? 'bg-green-500 border-green-500'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                {task.isCompleted && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`font-medium ${
                      task.isCompleted
                        ? 'text-slate-400 line-through'
                        : 'text-slate-950'
                    }`}
                  >
                    {task.title}
                  </h3>
                  {task.isDailyTemplate && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      데일리
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {safeTime(task.startDate)} ~ {safeTime(task.endDate)}
                </p>
                {task.description && (
                  <p className="mt-2 text-sm text-slate-600">{task.description}</p>
                )}
                {task.category && (
                  <div className="mt-2">
                    <span className="inline-block rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                      {task.category}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
