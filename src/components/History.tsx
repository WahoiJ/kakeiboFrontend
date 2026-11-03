import React, { useState, useEffect } from "react";
import { apiFetch, currentMonthString, errorMessage, yen, type DailyExpense } from "../api";

interface HistoryProps {
    userId: string;
    onRefresh?: () => void;
}

const formatDate = (date: string | null): string => {
    if (!date) return '日付なし';
    const d = new Date(`${date}T00:00:00`);
    const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}（${week}）`;
};

const formatMonth = (month: string): string => {
    const [y, m] = month.split('-');
    return `${y}年${Number(m)}月`;
};

export const History: React.FC<HistoryProps> = ({ userId, onRefresh }) => {
    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

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

    // 月ごとにグループ化（バックエンドで日付の新しい順に並んでいる）
    const groups: { month: string; items: DailyExpense[] }[] = [];
    for (const e of expenses) {
        const key = e.expense_date?.slice(0, 7) ?? '';
        const last = groups[groups.length - 1];
        if (last && last.month === key) last.items.push(e);
        else groups.push({ month: key, items: [e] });
    }

    return (
        <section className="card">
            <h2 className="card-title">出費履歴</h2>
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
                        <React.Fragment key={g.month || 'none'}>
                            <li className="history-month">
                                {g.month ? formatMonth(g.month) : '日付なし'}
                                {' ・ '}{yen(g.items.reduce((a, b) => a + b.amount, 0))}
                            </li>
                            {g.items.map(expense => (
                                <li key={expense.expense_id} className="history-item">
                                    <span className="history-date">{formatDate(expense.expense_date)}</span>
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
