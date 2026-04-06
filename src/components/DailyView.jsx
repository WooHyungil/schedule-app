import { useMemo, useState } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import { useStorage, generateId } from '../utils';

const DAY_OPTIONS = [
  { label: '일', value: 0 },
  { label: '월', value: 1 },
  { label: '화', value: 2 },
  { label: '수', value: 3 },
  { label: '목', value: 4 },
  { label: '금', value: 5 },
  { label: '토', value: 6 },
];

export default function DailyView() {
  const [dailyTemplates, setDailyTemplates] = useStorage('dailyTemplates', []);
  const [currentUser] = useStorage('currentUser', null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    mode: 'daily',
    weekDays: [1, 3, 5],
    monthDay: 1,
    visibility: 'private',
    onlyThisMonth: false,
    showTime: false,
    time: '09:00',
  });

  const ruleLabel = useMemo(() => {
    if (form.mode === 'daily') return '매일';
    if (form.mode === 'weekday') return '평일';
    if (form.mode === 'weekend') return '주말';
    if (form.mode === 'weekly') return '선택한 요일';
    return `매월 ${form.monthDay}일`;
  }, [form.mode, form.monthDay]);

  const addTemplate = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const newTemplate = {
      id: generateId(),
      title: form.title.trim(),
      description: form.description.trim(),
      ownerName: (currentUser?.name || '나').trim() || '나',
      visibility: form.visibility,
      rule: {
        mode: form.mode,
        days: form.mode === 'weekly' ? form.weekDays : [],
        monthDay: form.mode === 'monthly-date' ? Number(form.monthDay) : null,
        onlyThisMonth: form.onlyThisMonth,
        activeYear: form.onlyThisMonth ? new Date().getFullYear() : null,
        activeMonth: form.onlyThisMonth ? new Date().getMonth() + 1 : null,
      },
      showTime: form.showTime,
      time: form.showTime ? form.time : null,
      createdAt: new Date(),
    };

    setDailyTemplates([newTemplate, ...dailyTemplates]);
    setForm({
      title: '',
      description: '',
      mode: 'daily',
      weekDays: [1, 3, 5],
      monthDay: 1,
      visibility: 'private',
      onlyThisMonth: false,
      showTime: false,
      time: '09:00',
    });
  };

  const removeTemplate = (id) => {
    setDailyTemplates(dailyTemplates.filter((item) => item.id !== id));
  };

  const toggleWeekDay = (day) => {
    const exists = form.weekDays.includes(day);
    const next = exists ? form.weekDays.filter((d) => d !== day) : [...form.weekDays, day].sort((a, b) => a - b);
    setForm({ ...form, weekDays: next });
  };

  const getRuleText = (template) => {
    const mode = template?.rule?.mode || 'daily';
    let base = '매일';
    if (mode === 'weekday') base = '평일';
    else if (mode === 'weekend') base = '주말';
    if (mode === 'weekly') {
      const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
      const names = (template?.rule?.days || []).map((d) => dayMap[d]).join(', ');
      base = names ? `매주 ${names}` : '매주';
    }
    if (mode === 'monthly-date') base = `매월 ${template?.rule?.monthDay || 1}일`;
    return template?.rule?.onlyThisMonth ? `${base} · 이번 달만` : base;
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4">
        <h2 className="text-lg font-bold text-slate-800">데일리 기본 일정</h2>
        <p className="text-sm text-slate-500 mt-1">
          반복 규칙(매일/주말/날짜 선택)으로 자동 생성할 기본 일정을 설정합니다.
        </p>
      </div>

      <form onSubmit={addTemplate} className="bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-700">일정 제목</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="예: 아침 스트레칭"
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-700">반복 규칙</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { key: 'daily', label: '매일' },
              { key: 'weekday', label: '평일' },
              { key: 'weekend', label: '주말' },
              { key: 'weekly', label: '요일 선택' },
              { key: 'monthly-date', label: '날짜 선택' },
            ].map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setForm({ ...form, mode: mode.key })}
                className={`px-3 py-2 text-sm rounded-xl border transition-all ${
                  form.mode === mode.key
                    ? 'border-sky-500 bg-sky-50 text-sky-700 font-semibold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">현재 선택: {ruleLabel}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-700">추가 범위</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ key: 'private', label: '나만' }, { key: 'shared', label: '공통' }].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setForm({ ...form, visibility: item.key })}
                className={`px-3 py-2 text-sm rounded-xl border transition-all ${
                  form.visibility === item.key
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {form.mode === 'weekly' && (
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-700">요일 선택</label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekDay(day.value)}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    form.weekDays.includes(day.value)
                      ? 'border-sky-500 bg-sky-100 text-sky-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {form.mode === 'monthly-date' && (
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-700">매월 날짜</label>
            <input
              type="number"
              min="1"
              max="31"
              value={form.monthDay}
              onChange={(e) => setForm({ ...form, monthDay: Number(e.target.value || 1) })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400"
            />
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.onlyThisMonth}
              onChange={(e) => setForm({ ...form, onlyThisMonth: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
            />
            이번 달에만 적용
          </label>
          <p className="text-[11px] text-slate-500 mt-1">체크하면 다음 달부터 자동으로 적용되지 않습니다.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              시간 표시
            </label>
            <button
              type="button"
              onClick={() => setForm({ ...form, showTime: !form.showTime })}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.showTime ? 'bg-sky-500' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${form.showTime ? 'left-[22px]' : 'left-0.5'}`}
              />
            </button>
          </div>
          {form.showTime && (
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 mb-4"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-700">메모 (선택)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows="3"
            placeholder="데일리 일정에 대한 메모"
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl hover:brightness-110 font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          데일리 일정 추가
        </button>
      </form>

      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-slate-100 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">현재 데일리 목록 ({dailyTemplates.length})</h3>

        {dailyTemplates.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">아직 데일리 일정이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {dailyTemplates.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-xs text-sky-700">{getRuleText(item)}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {item.ownerName || '나'}
                    </span>
                    {item.visibility === 'shared' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">공통</span>
                    )}
                    {item.showTime && item.time && (
                      <span className="text-xs text-slate-500 flex items-center gap-0.5">
                        <Clock size={10} />
                        {item.time}
                      </span>
                    )}
                  </div>
                  {item.description && <p className="text-sm text-slate-600 mt-1">{item.description}</p>}
                </div>
                <button
                  onClick={() => removeTemplate(item.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="데일리 삭제"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
