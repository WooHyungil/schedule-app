import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { useStorage } from "../utils";

const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const fmtK = (n) => Number(n || 0).toLocaleString("ko-KR");
const fmtDate = (d) => new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
const fmtMonthDay = (d) => new Date(d).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
const toSafeArray = (value) => Array.isArray(value) ? value : [];
const EMPTY_STATS = Object.freeze({ txs: [], income: 0, expense: 0, balance: 0 });

function buildMonthlyStatsIndex(expenses) {
  const index = new Map();

  toSafeArray(expenses).forEach((item) => {
    if (!item) return;
    const ms = new Date(item.date).getTime();
    if (Number.isNaN(ms)) return;

    const d = new Date(ms);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const existing = index.get(key);
    const amount = Number(item?.amount || 0);

    if (existing) {
      existing.txs.push(item);
      if (item?.type === "income") existing.income += amount;
      else if (item?.type === "expense") existing.expense += amount;
      return;
    }

    index.set(key, {
      txs: [item],
      income: item?.type === "income" ? amount : 0,
      expense: item?.type === "expense" ? amount : 0,
      balance: 0,
    });
  });

  index.forEach((stats) => {
    stats.txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    stats.balance = stats.income - stats.expense;
  });

  return index;
}

function getMonthStats(index, year, month) {
  return index.get(`${year}-${month}`) || EMPTY_STATS;
}

function SummaryGrid({ income, expense, balance }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
      {[
        { label: "수입", value: income, color: "text-emerald-600", prefix: "+" },
        { label: "지출", value: expense, color: "text-rose-500", prefix: "-" },
        {
          label: "잔액",
          value: Math.abs(balance),
          color: balance >= 0 ? "text-sky-600" : "text-rose-500",
          prefix: balance >= 0 ? "" : "-",
        },
      ].map(({ label, value, color, prefix }) => (
        <div key={label} className="bg-white px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className={`mt-1 text-sm font-bold leading-tight ${color}`}>
            {prefix}{fmtK(value)}
            <span className="ml-0.5 text-[10px] font-normal text-slate-400">원</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function TransactionRow({ item }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          item.type === "income" ? "bg-emerald-100" : "bg-rose-50"
        }`}
      >
        {item.type === "income" ? (
          <TrendingUp size={14} className="text-emerald-600" />
        ) : (
          <TrendingDown size={14} className="text-rose-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-400">{fmtDate(item.date)}</span>
          {item.account && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {item.account}
            </span>
          )}
          {item.category && (
            <span className="text-[10px] text-slate-400">{item.category}</span>
          )}
          {item.budgetPeriodStart && item.budgetPeriodEnd && (
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              {fmtMonthDay(item.budgetPeriodStart)} ~ {fmtMonthDay(item.budgetPeriodEnd)}
            </span>
          )}
          {item.budgetAmount > 0 && (
            <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-600">
              예산 {fmtK(item.budgetAmount)}원
            </span>
          )}
          {item.memo && (
            <span className="text-[10px] text-slate-300">{item.memo}</span>
          )}
        </div>
      </div>
      <p
        className={`shrink-0 text-sm font-bold ${
          item.type === "income" ? "text-emerald-600" : "text-rose-500"
        }`}
      >
        {item.type === "income" ? "+" : "-"}{fmtK(item.amount)}원
      </p>
    </div>
  );
}

export default function FinanceView() {
  const [expenses] = useStorage("expenses", []);
  const safeExpenses = useMemo(() => toSafeArray(expenses), [expenses]);
  const monthlyStatsIndex = useMemo(() => buildMonthlyStatsIndex(safeExpenses), [safeExpenses]);
  const today = new Date();

  const [viewMode, setViewMode] = useState("monthly");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [rangeSize, setRangeSize] = useState(3);

  // ── 월별 ──────────────────────────────────────────────────
  const monthStats = useMemo(
    () => getMonthStats(monthlyStatsIndex, viewYear, viewMonth),
    [monthlyStatsIndex, viewYear, viewMonth],
  );

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  // ── 기간별 ────────────────────────────────────────────────
  const rangeMonths = useMemo(() => {
    const result = [];
    let y = viewYear;
    let m = viewMonth;
    for (let i = 0; i < rangeSize; i++) {
      const stats = getMonthStats(monthlyStatsIndex, y, m);
      result.unshift({ year: y, month: m, ...stats });
      if (m === 0) { y -= 1; m = 11; } else m -= 1;
    }
    return result;
  }, [monthlyStatsIndex, viewYear, viewMonth, rangeSize]);

  // ── 연간 ──────────────────────────────────────────────────
  const yearlyStats = useMemo(
    () => Array.from({ length: 12 }, (_, m) => ({ month: m, ...getMonthStats(monthlyStatsIndex, viewYear, m) })),
    [monthlyStatsIndex, viewYear],
  );
  const totalYearIncome = useMemo(() => yearlyStats.reduce((s, m) => s + m.income, 0), [yearlyStats]);
  const totalYearExpense = useMemo(() => yearlyStats.reduce((s, m) => s + m.expense, 0), [yearlyStats]);
  const totalYearBalance = totalYearIncome - totalYearExpense;

  const VIEW_MODES = [
    { key: "monthly", label: "월별" },
    { key: "range", label: "기간별" },
    { key: "yearly", label: "연간" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-6">

      {/* 뷰 모드 전환 */}
      <div className="glass-panel rounded-[30px] p-1.5">
        <div className="flex">
          {VIEW_MODES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              className={`flex-1 rounded-[24px] py-2.5 text-sm font-semibold transition-all ${
                viewMode === key
                  ? "bg-white shadow-sm text-slate-950"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 월별 뷰 ── */}
      {viewMode === "monthly" && (
        <>
          <div className="glass-panel overflow-hidden rounded-[30px]">
            <div className="flex items-center justify-between px-5 py-4">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              >
                <ChevronLeft size={18} className="text-slate-600" />
              </button>
              <p className="text-base font-semibold text-slate-800">
                {viewYear}년 {MONTH_NAMES[viewMonth]}
              </p>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              >
                <ChevronRight size={18} className="text-slate-600" />
              </button>
            </div>
            <SummaryGrid income={monthStats.income} expense={monthStats.expense} balance={monthStats.balance} />
          </div>

          <div className="glass-panel overflow-hidden rounded-[30px]">
            <div className="border-b border-white/60 bg-white/55 px-5 py-3">
              <p className="apple-section-title">거래 내역 · {monthStats.txs.length}건</p>
            </div>
            {monthStats.txs.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-300">이 달의 거래 내역이 없습니다</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {monthStats.txs.map((item) => (
                  <TransactionRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 기간별 뷰 ── */}
      {viewMode === "range" && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {[3, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRangeSize(n)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    rangeSize === n
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white/80 text-slate-600 shadow-sm hover:bg-white"
                  }`}
                >
                  {n}개월
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              >
                <ChevronLeft size={16} className="text-slate-600" />
              </button>
              <span className="min-w-[100px] text-center text-xs font-medium text-slate-500">
                {rangeMonths.length > 0
                  ? `${rangeMonths[0].year !== today.getFullYear() ? rangeMonths[0].year + "년 " : ""}${MONTH_NAMES[rangeMonths[0].month]} ~ ${MONTH_NAMES[rangeMonths[rangeMonths.length - 1].month]}`
                  : ""}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              >
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            </div>
          </div>

          <div className={`grid gap-3 ${rangeSize === 3 ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6"}`}>
            {rangeMonths.map(({ year, month, income, expense, balance, txs }) => (
              <div key={`${year}-${month}`} className="glass-panel rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-600">
                  {year !== today.getFullYear() && (
                    <span className="text-slate-400">{year}년 </span>
                  )}
                  {MONTH_NAMES[month]}
                </p>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">수입</span>
                    <span className="font-semibold text-emerald-600">+{fmtK(income)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">지출</span>
                    <span className="font-semibold text-rose-500">-{fmtK(expense)}</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-slate-100 pt-1.5 text-xs">
                    <span className="text-slate-400">잔액</span>
                    <span className={`font-bold ${balance >= 0 ? "text-sky-600" : "text-rose-500"}`}>
                      {balance >= 0 ? "" : "-"}{fmtK(Math.abs(balance))}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300">{txs.length}건</p>
                </div>
              </div>
            ))}
          </div>

          {rangeMonths.length > 0 && (() => {
            const totalIncome = rangeMonths.reduce((s, m) => s + m.income, 0);
            const totalExpense = rangeMonths.reduce((s, m) => s + m.expense, 0);
            const totalBalance = totalIncome - totalExpense;
            return (
              <div className="glass-panel overflow-hidden rounded-[30px]">
                <div className="border-b border-white/60 bg-white/55 px-5 py-3">
                  <p className="apple-section-title">{rangeSize}개월 합계</p>
                </div>
                <SummaryGrid income={totalIncome} expense={totalExpense} balance={totalBalance} />
              </div>
            );
          })()}
        </>
      )}

      {/* ── 연간 뷰 ── */}
      {viewMode === "yearly" && (
        <>
          <div className="glass-panel overflow-hidden rounded-[30px]">
            <div className="flex items-center justify-between px-5 py-4">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              >
                <ChevronLeft size={18} className="text-slate-600" />
              </button>
              <p className="text-base font-semibold text-slate-800">{viewYear}년 연간 요약</p>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              >
                <ChevronRight size={18} className="text-slate-600" />
              </button>
            </div>
            <SummaryGrid income={totalYearIncome} expense={totalYearExpense} balance={totalYearBalance} />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {yearlyStats.map(({ month, income, expense, balance }) => {
              const hasData = income > 0 || expense > 0;
              return (
                <div
                  key={month}
                  className={`glass-panel rounded-[20px] p-3 transition-opacity ${hasData ? "" : "opacity-50"}`}
                >
                  <p className="text-xs font-semibold text-slate-700">{MONTH_NAMES[month]}</p>
                  {hasData ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">수입</span>
                        <span className="font-semibold text-emerald-600">+{fmtK(income)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">지출</span>
                        <span className="font-semibold text-rose-500">-{fmtK(expense)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-1 text-[10px]">
                        <span className="text-slate-400">잔액</span>
                        <span className={`font-bold ${balance >= 0 ? "text-sky-600" : "text-rose-500"}`}>
                          {balance >= 0 ? "" : "-"}{fmtK(Math.abs(balance))}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-300">내역 없음</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
