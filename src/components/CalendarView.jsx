import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, TrendingUp, TrendingDown, Users, BellRing } from "lucide-react";
import { useStorage, formatDate, generateId, appliesTemplateOnDate } from "../utils";
import YearlyView from "./YearlyView";

const CAT_ACTIVE = {
  일반: "border-slate-500 bg-slate-100 text-slate-700",
  업무: "border-blue-500 bg-blue-50 text-blue-700",
  개인: "border-emerald-500 bg-emerald-50 text-emerald-700",
  약속: "border-violet-500 bg-violet-50 text-violet-700",
  휴가: "border-amber-500 bg-amber-50 text-amber-700",
  중요: "border-rose-500 bg-rose-50 text-rose-700",
};
const CAT_BADGE = {
  일반: "bg-slate-100 text-slate-600 border-slate-200",
  업무: "bg-blue-50 text-blue-700 border-blue-200",
  개인: "bg-emerald-50 text-emerald-700 border-emerald-200",
  약속: "bg-violet-50 text-violet-700 border-violet-200",
  휴가: "bg-amber-50 text-amber-700 border-amber-200",
  중요: "bg-rose-50 text-rose-700 border-rose-200",
};

function SectionCard({ title, badge, colorClass, isEmpty, emptyText, children }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 overflow-hidden">
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-black/5 ${colorClass}`}>
        <span className="text-xs font-bold tracking-wide">{title}</span>
        {badge > 0 && (
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60">{badge}개</span>
        )}
      </div>
      <div className="p-3">
        {isEmpty ? (
          <p className="text-slate-300 text-xs text-center py-4">{emptyText}</p>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </div>
    </div>
  );
}

function FieldBlock({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4 ${className}`}>
      {children}
    </div>
  );
}

function fmtTime(val) {
  try {
    return new Date(val).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function CalendarView() {
  const [events, setEvents] = useStorage("events", []);
  const [expenses, setExpenses] = useStorage("expenses", []);
  const [accounts] = useStorage("accounts", ["현금", "국민은행", "신한은행", "카카오뱅크"]);
  const [meetings, setMeetings] = useStorage("meetings", []);
  const [memos, setMemos] = useStorage("memos", []);
  const [quickTitles, setQuickTitles] = useStorage("quickTitles", []);
  const [dailyTemplates] = useStorage("dailyTemplates", []);
  const [dailyCompletionMap] = useStorage("dailyCompletionMap", {});
  const [notificationSettings] = useStorage("notificationSettings", { enabled: false, defaultReminderMinutes: 10 });
  const [currentUser] = useStorage("currentUser", null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isYearlyMode, setIsYearlyMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState("event");
  const [quickInput, setQuickInput] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", category: "일반",
    visibility: "private",
    showTime: false, startTime: "09:00", endTime: "10:00", reminderMinutes: notificationSettings.defaultReminderMinutes || 10,
  });
  const [financeForm, setFinanceForm] = useState({ title: "", amount: "", type: "expense", category: "식사", memo: "", account: "" });
  const [meetingForm, setMeetingForm] = useState({ title: "", attendees: "", content: "", decisions: "" });
  const [memoForm, setMemoForm] = useState({ title: "", content: "" });

  const categories = ["일반", "업무", "개인", "약속", "휴가", "중요"];
  const expenseCats = ["식사", "교통", "쇼핑", "생활비", "의료", "기타"];
  const incomeCats = ["월급", "부업", "용돈", "투자", "기타"];

  const addTypes = [
    { key: "event",   emoji: "📅", label: "일정"  },
    { key: "finance", emoji: "💰", label: "가계부" },
    { key: "meeting", emoji: "🗒",  label: "회의록" },
    { key: "memo",    emoji: "📝", label: "메모"  },
  ];

  const GRAD = {
    event:   "from-sky-500 to-indigo-600",
    finance: "from-amber-400 to-orange-500",
    meeting: "from-violet-500 to-purple-600",
    memo:    "from-teal-500 to-cyan-600",
  };

  const monthStart = useMemo(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), [selectedDate]);
  const monthEnd   = useMemo(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0), [selectedDate]);
  const daysInMonth   = monthEnd.getDate();
  const startDow      = monthStart.getDay();

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i));
    }
    return days;
  }, [selectedDate, daysInMonth, startDow]);

  const selectedDayEvents = useMemo(() => {
    const key = formatDate(selectedDate);
    const normal = events
      .filter((e) => formatDate(e.startDate) === key)
      .map((e) => ({ ...e, isDailyTemplate: false }));
    const daily = dailyTemplates
      .filter((t) => appliesTemplateOnDate(t, selectedDate))
      .map((t) => ({
        id: `daily-${t.id}-${key}`,
        templateId: t.id,
        title: t.title,
        description: t.description,
        ownerName: t.ownerName,
        visibility: t.visibility,
        category: t.category,
        showTime: t.showTime || false,
        startDate: new Date(`${key}T${t.time || "09:00"}`),
        endDate: null,
        isCompleted: Boolean(dailyCompletionMap[`${t.id}_${key}`]),
        isDailyTemplate: true,
      }));
    return [...daily, ...normal];
  }, [selectedDate, events, dailyTemplates, dailyCompletionMap]);

  const selectedDayFinance = useMemo(() => {
    const key = formatDate(selectedDate);
    return expenses
      .filter((e) => formatDate(e.date) === key)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [selectedDate, expenses]);

  const selectedDayMeetings = useMemo(() => {
    const key = formatDate(selectedDate);
    return meetings
      .filter((m) => formatDate(m.date) === key)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [selectedDate, meetings]);

  const selectedDayMemos = useMemo(() => {
    const key = formatDate(selectedDate);
    return memos
      .filter((m) => formatDate(m.date) === key)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [selectedDate, memos]);

  const getDayTotal = (date) => {
    if (!date) return 0;
    const key = formatDate(date);
    return (
      events.filter((e) => formatDate(e.startDate) === key).length +
      dailyTemplates.filter((t) => appliesTemplateOnDate(t, date)).length
    );
  };

  const prevMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  const nextMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));
  const goToday   = () => { setSelectedDate(new Date()); setIsYearlyMode(false); };

  const prevPeriod = () => {
    if (isYearlyMode) setSelectedDate(new Date(selectedDate.getFullYear() - 1, 0, 1));
    else prevMonth();
  };

  const nextPeriod = () => {
    if (isYearlyMode) setSelectedDate(new Date(selectedDate.getFullYear() + 1, 0, 1));
    else nextMonth();
  };

  const handleYearChange = (year) => {
    if (Number.isNaN(year)) return;
    const nextMonthValue = isYearlyMode ? 0 : selectedDate.getMonth() + 1;
    if (nextMonthValue === 0) setSelectedDate(new Date(year, 0, 1));
    else setSelectedDate(new Date(year, nextMonthValue - 1, 1));
  };

  const handleMonthChange = (monthValue) => {
    if (Number.isNaN(monthValue)) return;
    if (monthValue === 0) {
      setIsYearlyMode(true);
      setSelectedDate(new Date(selectedDate.getFullYear(), 0, 1));
      return;
    }
    setIsYearlyMode(false);
    setSelectedDate(new Date(selectedDate.getFullYear(), monthValue - 1, 1));
  };

  const deleteEvent   = (id) => setEvents(events.filter((e) => e.id !== id));
  const deleteExpense = (id) => setExpenses(expenses.filter((e) => e.id !== id));
  const deleteMeeting = (id) => setMeetings(meetings.filter((m) => m.id !== id));
  const deleteMemo    = (id) => setMemos(memos.filter((m) => m.id !== id));

  const openModal  = () => { setAddType("event"); setShowAddModal(true); };
  const closeModal = () => {
    setShowAddModal(false);
    setForm({
      title: "",
      description: "",
      category: "일반",
      visibility: "private",
      showTime: false,
      startTime: "09:00",
      endTime: "10:00",
      reminderMinutes: notificationSettings.defaultReminderMinutes || 10,
    });
    setFinanceForm({ title: "", amount: "", type: "expense", category: "식사", memo: "", account: "" });
    setMeetingForm({ title: "", attendees: "", content: "", decisions: "" });
    setMemoForm({ title: "", content: "" });
    setQuickInput("");
  };

  const addQuickTitle = () => {
    const t = quickInput.trim();
    if (!t || quickTitles.includes(t)) return;
    setQuickTitles([...quickTitles, t]);
    setQuickInput("");
  };
  const removeQuickTitle = (t) => setQuickTitles(quickTitles.filter((q) => q !== t));

  const handleCreateEvent = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const key = formatDate(selectedDate);
    const s  = form.showTime ? form.startTime : "00:00";
    const en = form.showTime ? form.endTime   : "00:00";
    setEvents([...events, {
      id: generateId(),
      title: form.title.trim(),
      description: form.description.trim(),
      ownerName: (currentUser?.name || "나").trim() || "나",
      visibility: form.visibility,
      startDate: new Date(`${key}T${s}`),
      endDate:   new Date(`${key}T${en}`),
      category:  form.category,
      showTime:  form.showTime,
      reminderMinutes: form.showTime ? Number(form.reminderMinutes || 0) : 0,
      tags: [], isCompleted: false, createdAt: new Date(),
    }]);
    closeModal();
  };

  const handleCreateFinance = (e) => {
    e.preventDefault();
    if (!financeForm.title.trim() || !financeForm.amount) return;
    const key = formatDate(selectedDate);
    setExpenses([{
      id: generateId(),
      title:    financeForm.title.trim(),
      amount:   Number(financeForm.amount),
      type:     financeForm.type,
      category: financeForm.category,
      account:  financeForm.account,
      memo:     financeForm.memo.trim(),
      date:     new Date(`${key}T12:00`),
      createdAt: new Date(),
    }, ...expenses]);
    closeModal();
  };

  const handleCreateMeeting = (e) => {
    e.preventDefault();
    if (!meetingForm.title.trim()) return;
    const key = formatDate(selectedDate);
    setMeetings([{
      id: generateId(),
      title:     meetingForm.title.trim(),
      attendees: meetingForm.attendees.trim(),
      content:   meetingForm.content.trim(),
      decisions: meetingForm.decisions.trim(),
      date:      new Date(`${key}T09:00`),
      createdAt: new Date(),
    }, ...meetings]);
    closeModal();
  };

  const handleCreateMemo = (e) => {
    e.preventDefault();
    if (!memoForm.title.trim()) return;
    const key = formatDate(selectedDate);
    setMemos([{
      id: generateId(),
      title:   memoForm.title.trim(),
      content: memoForm.content.trim(),
      date:    new Date(`${key}T12:00`),
      createdAt: new Date(),
    }, ...memos]);
    closeModal();
  };

  const handleSubmit = (e) => {
    if      (addType === "event")   handleCreateEvent(e);
    else if (addType === "finance") handleCreateFinance(e);
    else if (addType === "meeting") handleCreateMeeting(e);
    else                            handleCreateMemo(e);
  };

  const selLabel = selectedDate.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const toggleYearlyMode = () => {
    if (isYearlyMode) {
      setIsYearlyMode(false);
      if (selectedDate.getMonth() === 0) {
        setSelectedDate(new Date(selectedDate.getFullYear(), new Date().getMonth(), 1));
      }
      return;
    }
    setIsYearlyMode(true);
    setSelectedDate(new Date(selectedDate.getFullYear(), 0, 1));
  };

  return (
    <div className="p-3 max-w-4xl mx-auto pb-6 space-y-3">

      {/* 네비게이션 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevPeriod} className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronLeft size={20} className="text-slate-500" />
          </button>
          <h2 className="text-lg font-bold text-slate-800">
            {isYearlyMode
              ? `${selectedDate.getFullYear()}년 연간`
              : `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월`}
          </h2>
          <button onClick={nextPeriod} className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronRight size={20} className="text-slate-500" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <select
            value={selectedDate.getFullYear()}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          <select
            value={isYearlyMode ? 0 : selectedDate.getMonth() + 1}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            <option value={0}>00월 (연간 보기)</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>{String(month).padStart(2, "0")}월</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={goToday}
            className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors text-sm">
            오늘
          </button>
          <button onClick={toggleYearlyMode}
            className={`flex-1 py-2.5 rounded-xl font-semibold transition-colors text-sm ${
              isYearlyMode
                ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                : "bg-violet-100 text-violet-700 hover:bg-violet-200"
            }`}>
            {isYearlyMode ? "월간 보기" : "연간 보기"}
          </button>
          {!isYearlyMode && (
            <button onClick={openModal}
              className="flex-[2.5] py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white rounded-xl font-semibold hover:brightness-105 transition-all flex items-center justify-center gap-1.5 text-sm shadow-sm">
              <Plus size={16} strokeWidth={2.5} />
              {selLabel}에 기록 추가
            </button>
          )}
        </div>
      </div>

      {isYearlyMode ? (
        <YearlyView selectedYear={selectedDate.getFullYear()} hideYearSelector />
      ) : (
        <>

      {/* 달력 그리드 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4">
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {["일","월","화","수","목","금","토"].map((d, i) => (
            <div key={d} className={`text-center text-[11px] font-bold py-1 ${i===0?"text-rose-400":i===6?"text-blue-400":"text-slate-400"}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, idx) => {
            const isToday    = date && new Date().toDateString() === date.toDateString();
            const isSelected = date && selectedDate.toDateString() === date.toDateString();
            const total = getDayTotal(date);
            const isSun = date && date.getDay() === 0;
            const isSat = date && date.getDay() === 6;
            return (
              <button key={idx} onClick={() => date && setSelectedDate(date)}
                className={`aspect-square rounded-xl transition-all text-sm font-semibold flex flex-col items-center justify-center gap-0.5 ${
                  !date        ? "opacity-0 pointer-events-none"
                  : isSelected ? "bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md scale-105"
                  : isToday    ? "bg-sky-50 text-sky-600 ring-2 ring-sky-300"
                  : isSun      ? "text-rose-400 hover:bg-rose-50"
                  : isSat      ? "text-blue-400 hover:bg-blue-50"
                  :              "text-slate-700 hover:bg-slate-100"
                }`}>
                <span className="leading-none">{date?.getDate()}</span>
                {total > 0 && (
                  <span className={`w-3.5 h-1 rounded-full ${isSelected ? "bg-white/50" : "bg-sky-400/50"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 일정 섹션 */}
      <SectionCard title="📅 일정" badge={selectedDayEvents.length} colorClass="bg-sky-50"
        isEmpty={selectedDayEvents.length === 0} emptyText="이 날의 일정이 없습니다">
        {selectedDayEvents.map((ev) => (
          <div key={ev.id}
            className={`group p-3 rounded-xl border transition-colors ${
              ev.isDailyTemplate ? "bg-violet-50/70 border-violet-200" : "bg-white border-slate-100 hover:border-sky-200"
            }`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                    ev.isDailyTemplate
                      ? "bg-violet-100 text-violet-600 border-violet-200"
                      : (CAT_BADGE[ev.category] || CAT_BADGE["일반"])
                  }`}>
                    {ev.isDailyTemplate ? "데일리" : (ev.category || "일반")}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {ev.ownerName || "나"}
                  </span>
                  {ev.visibility === "shared" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">공통</span>
                  )}
                  {ev.showTime && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock size={10} />
                      {fmtTime(ev.startDate)}
                      {ev.endDate && fmtTime(ev.startDate) !== fmtTime(ev.endDate) && (
                        <> ~ {fmtTime(ev.endDate)}</>
                      )}
                    </span>
                  )}
                  {ev.reminderMinutes > 0 && (
                    <span className="text-[10px] text-violet-500 flex items-center gap-0.5">
                      <BellRing size={10} />
                      {ev.reminderMinutes}분 전 알림
                    </span>
                  )}
                </div>
                <p className="font-semibold text-slate-800 text-sm leading-snug">{ev.title}</p>
                {ev.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{ev.description}</p>}
              </div>
              {!ev.isDailyTemplate && (
                <button onClick={() => deleteEvent(ev.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-all mt-0.5">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </SectionCard>

      {/* 가계부 섹션 */}
      {selectedDayFinance.length > 0 && (
        <SectionCard title="💰 가계부" badge={selectedDayFinance.length} colorClass="bg-amber-50" isEmpty={false} emptyText="">
          {selectedDayFinance.map((item) => (
            <div key={item.id}
              className={`group p-3 rounded-xl border flex items-center gap-2 ${
                item.type === "income" ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-slate-100"
              }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.type === "income" ? "bg-emerald-100" : "bg-rose-100"}`}>
                {item.type === "income"
                  ? <TrendingUp size={14} className="text-emerald-600" />
                  : <TrendingDown size={14} className="text-rose-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-none">{item.title}</p>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-slate-400">{item.category}</span>
                  {item.account && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">{item.account}</span>}
                  {item.memo && <span className="text-[10px] text-slate-400">{item.memo}</span>}
                </div>
              </div>
              <p className={`font-bold text-sm shrink-0 ${item.type === "income" ? "text-emerald-600" : "text-rose-500"}`}>
                {item.type === "income" ? "+" : "-"}{Number(item.amount).toLocaleString("ko-KR")}원
              </p>
              <button onClick={() => deleteExpense(item.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-all">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </SectionCard>
      )}

      {/* 회의록 섹션 */}
      {selectedDayMeetings.length > 0 && (
        <SectionCard title="🗒 회의록" badge={selectedDayMeetings.length} colorClass="bg-violet-50" isEmpty={false} emptyText="">
          {selectedDayMeetings.map((m) => (
            <div key={m.id} className="group p-3 rounded-xl border bg-white border-slate-100">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 text-sm">{m.title}</p>
                  {m.attendees && (
                    <p className="text-[11px] text-violet-500 mt-0.5 flex items-center gap-1">
                      <Users size={10} />{m.attendees}
                    </p>
                  )}
                  {m.content && (
                    <div className="mt-2 pl-2 border-l-2 border-slate-200">
                      <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed">{m.content}</p>
                    </div>
                  )}
                  {m.decisions && (
                    <div className="mt-2 pl-2 border-l-2 border-violet-300">
                      <p className="text-[10px] font-bold text-violet-500 mb-0.5">결정 사항</p>
                      <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed">{m.decisions}</p>
                    </div>
                  )}
                </div>
                <button onClick={() => deleteMeeting(m.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-all shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* 메모 섹션 */}
      {selectedDayMemos.length > 0 && (
        <SectionCard title="📝 메모" badge={selectedDayMemos.length} colorClass="bg-teal-50" isEmpty={false} emptyText="">
          {selectedDayMemos.map((m) => (
            <div key={m.id} className="group p-3 rounded-xl border bg-white border-slate-100">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  {m.title && <p className="font-semibold text-slate-800 text-sm">{m.title}</p>}
                  {m.content && (
                    <p className="text-xs text-slate-500 mt-1 whitespace-pre-line leading-relaxed">{m.content}</p>
                  )}
                </div>
                <button onClick={() => deleteMemo(m.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-all shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* ===== 통합 추가 모달 ===== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 sm:px-4">
          <div className="bg-slate-50 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">

            {/* 모달 헤더 */}
            <div className={`px-5 pt-5 pb-4 flex-shrink-0 bg-gradient-to-br ${GRAD[addType]} text-white`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[11px] text-white/60 font-medium mb-0.5">
                    {selectedDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                  </p>
                  <h3 className="text-lg font-bold">새 기록 작성</h3>
                </div>
                <button onClick={closeModal}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors mt-0.5">
                  <X size={17} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 bg-black/20 rounded-2xl p-1">
                {addTypes.map((t) => (
                  <button key={t.key} type="button" onClick={() => setAddType(t.key)}
                    className={`py-2 text-[11px] font-bold rounded-xl transition-all flex flex-col items-center gap-0.5 ${
                      addType === t.key ? "bg-white text-slate-700 shadow-sm" : "text-white/50 hover:text-white/80"
                    }`}>
                    <span className="text-lg leading-none">{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 모달 바디 */}
            <div className="overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="p-4 space-y-3">

                {/* ===== 일정 폼 ===== */}
                {addType === "event" && (
                  <>
                    <Card>
                      <FieldBlock label="일정 제목">
                        <input
                          type="text" required autoFocus
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          className="w-full px-0 py-1 border-0 border-b-2 border-slate-200 focus:border-sky-400 bg-transparent text-slate-800 font-semibold text-base outline-none placeholder:font-normal placeholder:text-slate-300 transition-colors"
                          placeholder="일정 제목을 입력하세요"
                        />
                      </FieldBlock>

                      <FieldBlock label="빠른 입력">
                        <div className="flex flex-wrap gap-1.5 min-h-[28px] mb-2">
                          {quickTitles.length === 0 && (
                            <span className="text-xs text-slate-300 self-center">아래에서 자주 쓰는 항목을 추가하세요</span>
                          )}
                          {quickTitles.map((qt) => (
                            <button key={qt} type="button"
                              onClick={() => setForm({ ...form, title: qt })}
                              className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 text-xs rounded-full bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors">
                              {qt}
                              <span
                                role="button" tabIndex={0}
                                onClick={(ev) => { ev.stopPropagation(); removeQuickTitle(qt); }}
                                onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); removeQuickTitle(qt); } }}
                                className="w-4 h-4 rounded-full bg-sky-100 hover:bg-rose-100 hover:text-rose-500 flex items-center justify-center transition-colors">
                                <X size={9} />
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text" value={quickInput}
                            onChange={(e) => setQuickInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const t = quickInput.trim();
                                if (t && !quickTitles.includes(t)) { setQuickTitles([...quickTitles, t]); setQuickInput(""); }
                              }
                            }}
                            placeholder="추가할 항목 입력 후 Enter"
                            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200 bg-slate-50 text-slate-600"
                          />
                          <button type="button" onClick={addQuickTitle}
                            className="px-3 py-2 bg-sky-100 text-sky-700 rounded-xl text-xs font-bold hover:bg-sky-200 transition-colors whitespace-nowrap">
                            + 추가
                          </button>
                        </div>
                      </FieldBlock>
                    </Card>

                    <Card className="!space-y-0">
                      <FieldBlock label="카테고리">
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => (
                            <button key={cat} type="button"
                              onClick={() => setForm({ ...form, category: cat })}
                              className={`px-3 py-1.5 text-xs rounded-full border-2 font-bold transition-all ${
                                form.category === cat
                                  ? CAT_ACTIVE[cat]
                                  : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500"
                              }`}>
                              {cat}
                            </button>
                          ))}
                        </div>
                      </FieldBlock>
                    </Card>

                    <Card className="!space-y-0">
                      <FieldBlock label="추가 범위">
                        <div className="grid grid-cols-2 gap-2">
                          {[{ key: "private", label: "나만" }, { key: "shared", label: "공통" }].map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setForm({ ...form, visibility: item.key })}
                              className={`px-3 py-2 text-sm rounded-xl border transition-all ${
                                form.visibility === item.key
                                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </FieldBlock>
                    </Card>

                    <Card className="!space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">시간 설정</span>
                        </div>
                        <button type="button"
                          onClick={() => setForm({ ...form, showTime: !form.showTime })}
                          className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${form.showTime ? "bg-sky-500" : "bg-slate-200"}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${form.showTime ? "left-[26px]" : "left-0.5"}`} />
                        </button>
                      </div>
                      {form.showTime ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold mb-1.5">시작 시간</p>
                            <input type="time" value={form.startTime}
                              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-200 font-medium" />
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold mb-1.5">종료 시간</p>
                            <input type="time" value={form.endTime}
                              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-200 font-medium" />
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] text-slate-400 font-bold mb-1.5">푸시 알림</p>
                            <div className="flex gap-2 flex-wrap">
                              {[0, 10, 30].map((min) => (
                                <button
                                  key={min}
                                  type="button"
                                  onClick={() => setForm({ ...form, reminderMinutes: min })}
                                  className={`px-3 py-1.5 text-xs rounded-full border-2 font-bold transition-all ${
                                    Number(form.reminderMinutes) === min
                                      ? "border-violet-400 bg-violet-50 text-violet-700"
                                      : "border-slate-200 text-slate-400 hover:border-slate-300"
                                  }`}
                                >
                                  {min === 0 ? "없음" : `${min}분 전`}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 text-center py-0.5">꺼두면 종일 일정으로 저장됩니다</p>
                      )}
                    </Card>

                    <Card className="!space-y-0">
                      <FieldBlock label="메모 (선택)">
                        <textarea value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-sky-200 resize-none"
                          rows="3" placeholder="간단한 메모를 남겨보세요" />
                      </FieldBlock>
                    </Card>
                  </>
                )}

                {/* ===== 가계부 폼 ===== */}
                {addType === "finance" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { type: "expense", label: "지출", accentOn: "border-rose-400 bg-rose-50 text-rose-600", Icon: TrendingDown },
                        { type: "income",  label: "수입", accentOn: "border-emerald-400 bg-emerald-50 text-emerald-700", Icon: TrendingUp },
                      ].map(({ type, label, accentOn, Icon }) => (
                        <button key={type} type="button"
                          onClick={() => setFinanceForm({ ...financeForm, type, category: type === "expense" ? "식사" : "월급" })}
                          className={`py-5 rounded-2xl border-2 font-bold text-sm flex flex-col items-center gap-2 transition-all ${
                            financeForm.type === type ? accentOn : "border-slate-200 text-slate-300 hover:border-slate-300 bg-white"
                          }`}>
                          <Icon size={22} />
                          {label}
                        </button>
                      ))}
                    </div>

                    <Card>
                      <FieldBlock label="항목명">
                        <input type="text" required autoFocus value={financeForm.title}
                          onChange={(e) => setFinanceForm({ ...financeForm, title: e.target.value })}
                          className="w-full px-0 py-1 border-0 border-b-2 border-slate-200 focus:border-amber-400 bg-transparent text-slate-800 font-semibold text-base outline-none placeholder:font-normal placeholder:text-slate-300 transition-colors"
                          placeholder={financeForm.type === "income" ? "예: 월급, 용돈, 부업" : "예: 점심식사, 교통비"}
                        />
                      </FieldBlock>
                      <FieldBlock label="금액 (원)">
                        <input type="number" min="0" required value={financeForm.amount}
                          onChange={(e) => setFinanceForm({ ...financeForm, amount: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-200 font-medium"
                          placeholder="0" />
                      </FieldBlock>
                      {accounts.length > 0 && (
                        <FieldBlock label="통장 / 결제 수단">
                          <div className="flex flex-wrap gap-1.5">
                            {accounts.map((acc) => (
                              <button key={acc} type="button"
                                onClick={() => setFinanceForm({ ...financeForm, account: financeForm.account === acc ? "" : acc })}
                                className={`px-3 py-1.5 text-xs rounded-full border-2 font-bold transition-all ${
                                  financeForm.account === acc
                                    ? "border-amber-400 bg-amber-50 text-amber-700"
                                    : "border-slate-200 text-slate-400 hover:border-slate-300"
                                }`}>
                                {acc}
                              </button>
                            ))}
                          </div>
                        </FieldBlock>
                      )}
                    </Card>

                    <Card className="!space-y-0">
                      <FieldBlock label="카테고리">
                        <div className="flex flex-wrap gap-2">
                          {(financeForm.type === "expense" ? expenseCats : incomeCats).map((cat) => (
                            <button key={cat} type="button"
                              onClick={() => setFinanceForm({ ...financeForm, category: cat })}
                              className={`px-3 py-1.5 text-xs rounded-full border-2 font-bold transition-all ${
                                financeForm.category === cat
                                  ? financeForm.type === "expense"
                                    ? "border-amber-400 bg-amber-50 text-amber-700"
                                    : "border-emerald-400 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 text-slate-400 hover:border-slate-300"
                              }`}>
                              {cat}
                            </button>
                          ))}
                        </div>
                      </FieldBlock>
                    </Card>

                    <Card className="!space-y-0">
                      <FieldBlock label="메모 (선택)">
                        <textarea value={financeForm.memo}
                          onChange={(e) => setFinanceForm({ ...financeForm, memo: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none"
                          rows="2" placeholder="메모" />
                      </FieldBlock>
                    </Card>
                  </>
                )}

                {/* ===== 회의록 폼 ===== */}
                {addType === "meeting" && (
                  <>
                    <Card>
                      <FieldBlock label="회의 제목">
                        <input type="text" required autoFocus value={meetingForm.title}
                          onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                          className="w-full px-0 py-1 border-0 border-b-2 border-slate-200 focus:border-violet-400 bg-transparent text-slate-800 font-semibold text-base outline-none placeholder:font-normal placeholder:text-slate-300 transition-colors"
                          placeholder="예: 주간 팀 미팅" />
                      </FieldBlock>
                      <FieldBlock label="참석자 (선택)">
                        <input type="text" value={meetingForm.attendees}
                          onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-200"
                          placeholder="예: 홍길동, 김철수" />
                      </FieldBlock>
                    </Card>

                    <Card className="!space-y-0">
                      <FieldBlock label="회의 내용">
                        <textarea value={meetingForm.content}
                          onChange={(e) => setMeetingForm({ ...meetingForm, content: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
                          rows="4" placeholder="오늘 논의한 내용을 기록하세요" />
                      </FieldBlock>
                    </Card>

                    <Card className="!space-y-0">
                      <FieldBlock label="결정 사항 (선택)">
                        <textarea value={meetingForm.decisions}
                          onChange={(e) => setMeetingForm({ ...meetingForm, decisions: e.target.value })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none"
                          rows="3" placeholder="결정된 내용, 액션 아이템 등" />
                      </FieldBlock>
                    </Card>
                  </>
                )}

                {/* ===== 메모 폼 ===== */}
                {addType === "memo" && (
                  <Card>
                    <FieldBlock label="제목">
                      <input type="text" required autoFocus value={memoForm.title}
                        onChange={(e) => setMemoForm({ ...memoForm, title: e.target.value })}
                        className="w-full px-0 py-1 border-0 border-b-2 border-slate-200 focus:border-teal-400 bg-transparent text-slate-800 font-semibold text-base outline-none placeholder:font-normal placeholder:text-slate-300 transition-colors"
                        placeholder="메모 제목" />
                    </FieldBlock>
                    <FieldBlock label="내용 (선택)">
                      <textarea value={memoForm.content}
                        onChange={(e) => setMemoForm({ ...memoForm, content: e.target.value })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 resize-none"
                        rows="7" placeholder="내용을 자유롭게 적어보세요..." />
                    </FieldBlock>
                  </Card>
                )}

                {/* 저장/취소 버튼 */}
                <div className="flex gap-2 pt-1 pb-3">
                  <button type="button" onClick={closeModal}
                    className="flex-1 py-3.5 border-2 border-slate-200 rounded-2xl text-slate-500 font-bold text-sm hover:bg-white transition-colors">
                    취소
                  </button>
                  <button type="submit"
                    className={`flex-[2] py-3.5 text-white rounded-2xl font-bold text-sm bg-gradient-to-r ${GRAD[addType]} hover:brightness-105 transition-all shadow-sm`}>
                    저장하기
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
