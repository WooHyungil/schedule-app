import { useState, useMemo } from 'react';
import { useStorage, formatDate, appliesTemplateOnDate } from '../utils';

export default function TodoView() {
  const [events, setEvents] = useStorage('events', []);
  const [dailyTemplates] = useStorage('dailyTemplates', []);
  const [dailyCompletionMap, setDailyCompletionMap] = useStorage('dailyCompletionMap', {});
  const [showCompleted, setShowCompleted] = useState(true);

  const today = formatDate(new Date()).split('T')[0];

  const todayTasks = useMemo(() => {
    const date = new Date(today);

    const normal = events
      .filter((event) => formatDate(event.startDate).split('T')[0] === today)
      .map((event) => ({ ...event, isDailyTemplate: false }));

    const daily = dailyTemplates
      .filter((template) => appliesTemplateOnDate(template, date))
      .map((template) => ({
        id: `daily-${template.id}-${today}`,
        templateId: template.id,
        title: template.title,
        description: template.description,
        ownerName: template.ownerName,
        visibility: template.visibility,
        startDate: new Date(`${today}T09:00`),
        endDate: new Date(`${today}T10:00`),
        isCompleted: Boolean(dailyCompletionMap[`${template.id}_${today}`]),
        isDailyTemplate: true,
      }));

    return [...daily, ...normal];
  }, [events, dailyTemplates, today, dailyCompletionMap]);

  const filteredTasks = showCompleted
    ? todayTasks
    : todayTasks.filter((task) => !task.isCompleted);

  const completionPercentage =
    todayTasks.length === 0 ? 0 : (todayTasks.filter((t) => t.isCompleted).length / todayTasks.length) * 100;

  const toggleCompletion = (task) => {
    if (task.isDailyTemplate) {
      const key = `${task.templateId}_${today}`;
      setDailyCompletionMap({
        ...dailyCompletionMap,
        [key]: !task.isCompleted,
      });
      return;
    }

    setEvents(
      events.map((event) =>
        event.id === task.id ? { ...event, isCompleted: !event.isCompleted } : event
      )
    );
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h2 className="text-lg font-bold mb-4">
          {new Date().toLocaleDateString('ko-KR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </h2>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">진행률</span>
              <span className="text-lg font-bold text-blue-600">
                {Math.round(completionPercentage)}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-orange-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">남은 작업</p>
              <p className="text-lg font-bold text-orange-600">
                {todayTasks.filter((t) => !t.isCompleted).length}개
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">완료됨</p>
              <p className="text-lg font-bold text-green-600">
                {todayTasks.filter((t) => t.isCompleted).length}개
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            id="showCompleted"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="w-4 h-4 rounded border-2 border-gray-300"
          />
          <label htmlFor="showCompleted" className="text-sm font-medium cursor-pointer">
            완료된 항목 표시
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500 text-lg font-medium">
              {showCompleted ? '오늘의 일정이 없습니다' : '모든 작업을 완료했습니다! 🎉'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3"
            >
              <button
                onClick={() => toggleCompletion(task)}
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 transition-colors ${
                  task.isCompleted
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 hover:border-gray-400'
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
                        ? 'text-gray-400 line-through'
                        : 'text-gray-900'
                    }`}
                  >
                    {task.title}
                  </h3>
                  {task.isDailyTemplate && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      데일리
                    </span>
                  )}
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {task.ownerName || '나'}
                  </span>
                  {task.visibility === 'shared' && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      공통
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(task.startDate).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ~{' '}
                  {new Date(task.endDate).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {task.description && (
                  <p className="text-sm text-gray-600 mt-2">{task.description}</p>
                )}
                {task.category && (
                  <div className="mt-2">
                    <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
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
