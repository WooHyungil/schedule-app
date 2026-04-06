import { useState, useMemo } from "react";
import { X, Wallet, TrendingDown, TrendingUp, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { useStorage } from "../utils";

export default function FinanceView() {
  const [expenses] = useStorage("expenses", []);
  const [accounts, setAccounts] = useStorage("accounts", ["현금", "국민은행", "신한은행", "카카오뱅크"]);
  const [salarySettings, setSalarySettings] = useStorage("salarySettings", { day: 25 });
  const [newAccount, setNewAccount] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const today = new Date();
  const salaryDay = salarySettings.day;

  const periodStart = useMemo(() => {
    const d =
      today.getDate() >= salaryDay
        ? new Date(today.getFullYear(), today.getMonth(), salaryDay)
        : new Date(today.getFullYear(), today.getMonth() - 1, salaryDay);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [salaryDay]);

  const nextSalary = useMemo(() => {
    return today.getDate() >= salaryDay
      ? new Date(today.getFullYear(), today.getMonth() + 1, salaryDay)
      : new Date(today.getFullYear(), today.getMonth(), salaryDay);
  }, [salaryDay]);

  const daysLeft = Math.max(0, Math.ceil((nextSalary - today) / 86400000));

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  const fmtK = (n) => Number(n).toLocaleString("ko-KR");

  const periodLabel = `${fmtDate(periodStart)} ~ ${fmtDate(nextSalary)}`;

  const periodTx = useMemo(() => {
    return expenses
      .filter((e) => new Date(e.date) >= periodStart)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, salaryDay]);

  const totalIncome = useMemo(
    () => periodTx.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0),
    [periodTx]
  );
  const totalExpense = useMemo(
    () => periodTx.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0),
    [periodTx]
  );
  const balance = totalIncome - totalExpense;

  const byAccount = useMemo(() => {
    const map = {};
    periodTx.forEach((e) => {
      const acc = e.account || "미지정";
      if (!map[acc]) map[acc] = { income: 0, expense: 0 };
      if (e.type === "income") map[acc].income += e.amount;
      else map[acc].expense += e.amount;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v, net: v.income - v.expense }))
      .sort((a, b) => b.expense - a.expense);
  }, [periodTx]);

  const addAccount = () => {
    const t = newAccount.trim();
    if (!t || accounts.includes(t)) return;
    setAccounts([...accounts, t]);
    setNewAccount("");
  };

  return (
    <div className="p-3 max-w-4xl mx-auto pb-6 space-y-3">

      {/* 월급 주기 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 overflow-hidden">
        <div className="px-4 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/60 font-medium">현재 월급 주기</p>
            <p className="font-bold mt-0.5">{periodLabel}</p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors"
          >
            설정
            {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* 설정 패널 */}
        {showSettings && (
          <div className="p-4 space-y-5 bg-white border-b border-slate-100">
            {/* 월급일 */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">월급일 설정</p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">매월</span>
                <input
                  type="number" min="1" max="31"
                  value={salarySettings.day}
                  onChange={(e) =>
                    setSalarySettings({ ...salarySettings, day: Math.min(31, Math.max(1, Number(e.target.value) || 25)) })
                  }
                  className="w-16 px-3 py-2 border border-slate-200 rounded-xl text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <span className="text-sm text-slate-600">일</span>
              </div>
            </div>

            {/* 계좌 관리 */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">계좌 / 결제 수단 관리</p>
              <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
                {accounts.length === 0 && (
                  <span className="text-xs text-slate-300 self-center">아래에서 계좌를 추가하세요</span>
                )}
                {accounts.map((a) => (
                  <span
                    key={a}
                    className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 text-xs rounded-full bg-slate-100 text-slate-600 border border-slate-200"
                  >
                    {a}
                    <button
                      onClick={() => setAccounts(accounts.filter((acc) => acc !== a))}
                      className="w-4 h-4 rounded-full bg-slate-200 hover:bg-rose-100 hover:text-rose-500 flex items-center justify-center transition-colors"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAccount(); } }}
                  placeholder="예: 국민은행, 카카오페이"
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-slate-50"
                />
                <button
                  onClick={addAccount}
                  className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-200 transition-colors whitespace-nowrap"
                >
                  + 추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* D-day + 잔액 배너 */}
        <div className="px-4 py-3 flex items-center gap-3 bg-emerald-50/50 border-t border-emerald-100/50">
          <Calendar size={16} className="text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="text-[11px] text-slate-400">다음 월급까지</p>
            <p className="font-bold text-emerald-700 text-sm">
              D-{daysLeft}{" "}
              <span className="text-xs text-slate-400 font-medium">({fmtDate(nextSalary)})</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400">현재 잔액</p>
            <p className={`font-bold text-sm ${balance >= 0 ? "text-sky-600" : "text-rose-500"}`}>
              {balance >= 0 ? "" : "-"}{fmtK(Math.abs(balance))}원
            </p>
          </div>
        </div>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "수입",  value: totalIncome,         color: "text-emerald-600", prefix: "+" },
          { label: "지출",  value: totalExpense,        color: "text-rose-500",    prefix: "-" },
          {
            label: "잔액",
            value: Math.abs(balance),
            color: balance >= 0 ? "text-sky-600" : "text-rose-500",
            prefix: balance >= 0 ? "" : "-",
          },
        ].map(({ label, value, color, prefix }) => (
          <div key={label} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm p-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-bold mt-1 ${color} leading-tight`}>
              {prefix}{fmtK(value)}
              <span className="text-[10px] font-normal ml-0.5 text-slate-400">원</span>
            </p>
          </div>
        ))}
      </div>

      {/* 계좌별 현황 */}
      {byAccount.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">계좌 · 결제 수단별 현황</p>
          </div>
          <div className="divide-y divide-slate-50">
            {byAccount.map(({ name, income, expense, net }) => (
              <div key={name} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Wallet size={14} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{name}</p>
                  <div className="flex gap-2 mt-0.5">
                    {income > 0 && (
                      <span className="text-[10px] text-emerald-600 font-medium">+{fmtK(income)}</span>
                    )}
                    {expense > 0 && (
                      <span className="text-[10px] text-rose-500 font-medium">-{fmtK(expense)}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${net >= 0 ? "text-slate-700" : "text-rose-500"}`}>
                    {net >= 0 ? "" : "-"}{fmtK(Math.abs(net))}원
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 이번 주기 거래 내역 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            이번 주기 거래 내역 · {periodTx.length}건
          </p>
        </div>
        {periodTx.length === 0 ? (
          <p className="text-slate-300 text-xs text-center py-8">이번 주기 거래 내역이 없습니다</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {periodTx.map((e) => (
              <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    e.type === "income" ? "bg-emerald-100" : "bg-rose-50"
                  }`}
                >
                  {e.type === "income" ? (
                    <TrendingUp size={14} className="text-emerald-600" />
                  ) : (
                    <TrendingDown size={14} className="text-rose-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{e.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">{fmtDate(e.date)}</span>
                    {e.account && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {e.account}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{e.category}</span>
                    {e.memo && <span className="text-[10px] text-slate-300">{e.memo}</span>}
                  </div>
                </div>
                <p
                  className={`font-bold text-sm shrink-0 ${
                    e.type === "income" ? "text-emerald-600" : "text-rose-500"
                  }`}
                >
                  {e.type === "income" ? "+" : "-"}{fmtK(e.amount)}원
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
