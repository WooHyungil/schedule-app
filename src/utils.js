import { useEffect, useState } from 'react';

const STORAGE_EVENT = 'schedule-storage-change';

export const useStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      window.dispatchEvent(
        new CustomEvent(STORAGE_EVENT, {
          detail: { key, value: valueToStore },
        })
      );
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const syncFromStorage = (nextValue) => {
      setStoredValue(nextValue === undefined ? initialValue : nextValue);
    };

    const handleStorage = (event) => {
      if (event.key !== key) return;
      if (event.newValue == null) {
        syncFromStorage(initialValue);
        return;
      }

      try {
        syncFromStorage(JSON.parse(event.newValue));
      } catch (error) {
        console.log(error);
      }
    };

    const handleCustomStorage = (event) => {
      if (event.detail?.key !== key) return;
      syncFromStorage(event.detail?.value);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(STORAGE_EVENT, handleCustomStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(STORAGE_EVENT, handleCustomStorage);
    };
  }, [initialValue, key]);

  return [storedValue, setValue];
};

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatTime = (date) => {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const getMonthString = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const dateKey = (date) => formatDate(date);

export const appliesTemplateOnDate = (template, targetDate) => {
  const date = new Date(targetDate);
  const day = date.getDay();
  const mode = template?.rule?.mode || 'daily';

  if (template?.rule?.onlyThisMonth) {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth() + 1;

    const activeYear = Number(template?.rule?.activeYear);
    const activeMonth = Number(template?.rule?.activeMonth);

    if (!Number.isNaN(activeYear) && !Number.isNaN(activeMonth) && activeYear > 0 && activeMonth > 0) {
      if (targetYear !== activeYear || targetMonth !== activeMonth) return false;
    } else {
      const created = new Date(template?.createdAt || Date.now());
      if (targetYear !== created.getFullYear() || targetMonth !== created.getMonth() + 1) return false;
    }
  }

  if (mode === 'daily') return true;
  if (mode === 'weekday') return day >= 1 && day <= 5;
  if (mode === 'weekend') return day === 0 || day === 6;

  if (mode === 'weekly') {
    const days = template?.rule?.days || [];
    return days.includes(day);
  }

  if (mode === 'monthly-date') {
    const monthDay = Number(template?.rule?.monthDay || 1);
    return date.getDate() === monthDay;
  }

  return true;
};
