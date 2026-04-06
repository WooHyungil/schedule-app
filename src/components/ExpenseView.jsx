import { useState, useMemo } from 'react';
import { Plus, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStorage, generateId, formatDate, formatCurrency } from '../utils';

const EXPENSE_CATEGORIES = [
  { id: 'food', name: '식사', emoji: '🍔' },
  { id: 'transport', name: '교통', emoji: '🚗' },
  { id: 'entertainment', name: '오락', emoji: '🎬' },
  { id: 'shopping', name: '쇼핑', emoji: '🛍️' },
  { id: 'utility', name: '생활비', emoji: '🏠' },
  { id: 'education', name: '교육', emoji: '📚' },
  { id: 'healthcare', name: '의료', emoji: '🏥' },
  { id: 'etc', name: '기타', emoji: '💰' },
];

export default function ExpenseView() {
  const [expenses, setExpenses] = useStorage('expenses', []);
  const [showModal, setShowModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'food',
    memo: '',
    date: formatDate(new Date()),
  });

  const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

  const monthlyExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const expenseDate = formatDate(expense.date);
      return expenseDate.startsWith(monthKey);
    });
  }, [expenses, monthKey]);

  const monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const expensesByCategory = useMemo(() => {
    const result = {};
    monthlyExpenses.forEach((expense) => {
      result[expense.category] = (result[expense.category] || 0) + expense.amount;
    });
    return result;
  }, [monthlyExpenses]);

  const previousMonth = () => {
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1)
    );
  };

  const nextMonth = () => {
    setSelectedMonth(
      new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
    );
  };

  const thisMonth = () => {
    setSelectedMonth(new Date());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount) return;

    const newExpense = {
      id: generateId(),
      title: form.title,
      amount: parseFloat(form.amount),
      category: form.category,
      memo: form.memo,
      date: new Date(form.date),
      createdAt: new Date(),
    };

    setExpenses([...expenses, newExpense]);
    setForm({
      title: '',
      amount: '',
      category: 'food',
      memo: '',
      date: formatDate(new Date()),
    });
    setShowModal(false);
  };

  const handleDelete = (id) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const getCategoryInfo = (categoryId) => {
    return EXPENSE_CATEGORIES.find((cat) => cat.id === categoryId);
  };

  const sortedCategoryExpenses = Object.entries(expensesByCategory)
    .map(([categoryId, amount]) => ({
      categoryId,
      amount,
      percentage: (amount / monthlyTotal) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* 월 선택 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <h2 className="text-xl font-bold">
            {selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월
          </h2>

          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <button
          onClick={thisMonth}
          className="w-full py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          이번 달
        </button>
      </div>

      {/* 월 총액 */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm p-6 mb-4 text-white">
        <p className="text-sm opacity-90 mb-1">이번 달 총 지출</p>
        <h1 className="text-4xl font-bold">{formatCurrency(monthlyTotal)}</h1>
      </div>

      {/* 카테고리별 지출 */}
      {monthlyExpenses.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h3 className="font-bold mb-4">카테고리별 지출</h3>
          <div className="space-y-3">
            {sortedCategoryExpenses.map(({ categoryId, amount, percentage }) => {
              const category = getCategoryInfo(categoryId);
              return (
                <div key={categoryId}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{category?.emoji}</span>
                      <span className="font-medium">{category?.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(amount)}</p>
                      <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 지출 내역 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">지출 내역</h3>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
          >
            <Plus size={18} />
            추가
          </button>
        </div>

        {monthlyExpenses.length === 0 ? (
          <p className="text-center text-gray-500 py-8">이번 달 지출이 없습니다</p>
        ) : (
          <div className="space-y-2">
            {monthlyExpenses
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((expense) => {
                const category = getCategoryInfo(expense.category);
                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{category?.emoji}</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{expense.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(expense.date).toLocaleDateString('ko-KR')}
                          {expense.memo && ` · ${expense.memo}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-red-600 text-right">
                        {formatCurrency(expense.amount)}
                      </p>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">지출 추가</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 항목명 */}
              <div>
                <label className="block text-sm font-medium mb-1">항목명</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 점심"
                />
              </div>

              {/* 금액 */}
              <div>
                <label className="block text-sm font-medium mb-1">금액</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium">₩</span>
                  <input
                    type="number"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-medium mb-2">카테고리</label>
                <div className="grid grid-cols-4 gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat.id })}
                      className={`p-3 rounded-lg text-center transition-colors ${
                        form.category === cat.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <div className="text-2xl mb-1">{cat.emoji}</div>
                      <div className="text-xs font-medium">{cat.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 */}
              <div>
                <label className="block text-sm font-medium mb-1">날짜</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium mb-1">메모 (선택)</label>
                <input
                  type="text"
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="추가 정보"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
