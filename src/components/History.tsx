import React, { useState, useEffect } from "react";
import { apiFetch, currentMonthString, errorMessage, yen, type DailyExpense } from "../api";

interface HistoryProps {
    userId: string;
    onRefresh?: () => void;
}

const formatDate = (date: string | null, withYear = false): string => {
    if (!date) return '日付なし';
    const d = new Date(`${date}T00:00:00`);
    const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${withYear ? `${d.getFullYear()}/` : ''}${d.getMonth() + 1}/${d.getDate()}（${week}）`;
};

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'date-desc', label: '日付が新しい順' },
    { key: 'date-asc', label: '日付が古い順' },
    { key: 'amount-desc', label: '金額が高い順' },
    { key: 'amount-asc', label: '金額が安い順' },
];

const SORT_STORAGE_KEY = 'historySort';

const loadSortKey = (): SortKey => {
    try {
        const v = localStorage.getItem(SORT_STORAGE_KEY);
        if (SORT_OPTIONS.some(o => o.key === v)) return v as SortKey;
    } catch {
        // localStorage が使えない環境では既定値
    }
    return 'date-desc';
};

const compareDate = (a: DailyExpense, b: DailyExpense): number =>
    (a.expense_date ?? '').localeCompare(b.expense_date ?? '') || a.expense_id - b.expense_id;

const sortExpenses = (list: DailyExpense[], key: SortKey): DailyExpense[] => {
    const sorted = [...list];
    switch (key) {
        case 'date-desc': return sorted.sort((a, b) => compareDate(b, a));
        case 'date-asc': return sorted.sort(compareDate);
        // 同じ金額なら新しい日付を先に
        case 'amount-desc': return sorted.sort((a, b) => b.amount - a.amount || compareDate(b, a));
        case 'amount-asc': return sorted.sort((a, b) => a.amount - b.amount || compareDate(b, a));
    }
};

const formatMonth = (month: string): string => {
    const [y, m] = month.split('-');
    return `${y}年${Number(m)}月`;
};

export const History: React.FC<HistoryProps> = ({ userId, onRefresh }) => {
    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>(loadSortKey);

    const handleSortChange = (key: SortKey) => {
        setSortKey(key);
        try {
            localStorage.setItem(SORT_STORAGE_KEY, key);
        } catch {
            // 保存できなくても並び替え自体は有効
        }
    };

    useEffect(() => {
        if (!userId || userId === 'undefined') {
            setError('ユーザーIDが設定されていません');
            return;
        }
        apiFetch<DailyExpense[] | null>(`/api/expenses?userId=${Number(userId)}`)
            .then(data => {
                setExpenses(data ?? []);
                setError(null);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setError(errorMessage(err, '出費履歴の取得に失敗しました'));
            })
            .finally(() => setLoading(false));
    }, [userId]);

    const handleDeleteExpense = async (expenseId: number) => {
        try {
            // 月別出費の合計はバックエンドで自動再計算される
            await apiFetch<void>(`/api/expenses/${expenseId}`, { method: 'DELETE' });
            setExpenses(prev => prev.filter(expense => expense.expense_id !== expenseId));
            onRefresh?.();
        } catch (err) {
            console.error('Delete error:', err);
            setError(errorMessage(err, '削除に失敗しました'));
        }
    };

    const month = currentMonthString();
    const monthTotal = expenses
        .filter(e => e.expense_date?.startsWith(month))
        .reduce((a, b) => a + b.amount, 0);
    const allTotal = expenses.reduce((a, b) => a + b.amount, 0);

    const sorted = sortExpenses(expenses, sortKey);
    const byDate = sortKey.startsWith('date');

    // 日付順のときは月ごとにグループ化、金額順のときは月をまたいだ1つのリスト
    const groups: { month: string | null; items: DailyExpense[] }[] = [];
    if (byDate) {
        for (const e of sorted) {
            const key = e.expense_date?.slice(0, 7) ?? '';
            const last = groups[groups.length - 1];
            if (last && last.month === key) last.items.push(e);
            else groups.push({ month: key, items: [e] });
        }
    } else if (sorted.length > 0) {
        groups.push({ month: null, items: sorted });
    }

    return (
        <section className="card">
            <div className="card-header">
                <h2 className="card-title">出費履歴</h2>
                <select
                    className="select"
                    aria-label="並び替え"
                    value={sortKey}
                    onChange={(e) => handleSortChange(e.target.value as SortKey)}
                >
                    {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
            </div>
            <div className="totals">
                <div className="total-box"><span>今月の合計</span><b>{yen(monthTotal)}</b></div>
                <div className="total-box"><span>全期間の合計</span><b>{yen(allTotal)}</b></div>
            </div>
            {error && <p className="msg-error">{error}</p>}
            {loading ? (
                <p className="empty">読み込み中…</p>
            ) : expenses.length === 0 ? (
                <p className="empty">出費がありません</p>
            ) : (
                <ul className="history-list">
                    {groups.map(g => (
                        <React.Fragment key={g.month ?? 'all'}>
                            {g.month !== null && (
                                <li className="history-month">
                                    {g.month ? formatMonth(g.month) : '日付なし'}
                                    {' ・ '}{yen(g.items.reduce((a, b) => a + b.amount, 0))}
                                </li>
                            )}
                            {g.items.map(expense => (
                                <li key={expense.expense_id} className="history-item">
                                    <span className="history-date">{formatDate(expense.expense_date, !byDate)}</span>
                                    <span className="history-amount">{yen(expense.amount)}</span>
                                    <button
                                        className="btn btn-danger"
                                        aria-label={`${expense.expense_date}の${expense.amount}円を削除`}
                                        onClick={() => {
                                            if (window.confirm(`${expense.expense_date}の${yen(expense.amount)}を削除しますか？`)) {
                                                handleDeleteExpense(expense.expense_id);
                                            }
                                        }}
                                    >
                                        削除
                                    </button>
                                </li>
                            ))}
                        </React.Fragment>
                    ))}
                </ul>
            )}
        </section>
    );
};
