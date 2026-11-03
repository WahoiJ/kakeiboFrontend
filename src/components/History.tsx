import React, { useState, useEffect, useRef } from "react";
import { ExpenseEditRow } from "./ExpenseEditRow";
import { loadDraft, saveDraft } from "../draft";
import { categoryOf } from "../categories";
import { apiFetch, currentMonthString, errorMessage, todayString, yen, type DailyExpense } from "../api";

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

type PeriodKey = 'all' | 'thisMonth' | 'lastMonth' | 'last7' | 'last30' | 'month' | 'range';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
    { key: 'all', label: '全期間' },
    { key: 'thisMonth', label: '今月' },
    { key: 'lastMonth', label: '先月' },
    { key: 'last7', label: '直近7日' },
    { key: 'last30', label: '直近30日' },
    { key: 'month', label: '月を指定' },
    { key: 'range', label: '期間を指定' },
];

type PeriodFilter = { period: PeriodKey; periodMonth: string; rangeFrom: string; rangeTo: string; category?: string };

const daysAgo = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return todayString(d);
};

const lastMonthString = (): string => {
    const d = new Date();
    return currentMonthString(new Date(d.getFullYear(), d.getMonth() - 1, 1));
};

/** 期間を [開始日, 終了日]（YYYY-MM-DD、両端を含む）で返す。null は制限なし */
const periodRange = (key: PeriodKey, month: string, from: string, to: string): [string | null, string | null] => {
    switch (key) {
        case 'all': return [null, null];
        case 'thisMonth': return [`${currentMonthString()}-01`, `${currentMonthString()}-31`];
        case 'lastMonth': return [`${lastMonthString()}-01`, `${lastMonthString()}-31`];
        case 'last7': return [daysAgo(6), todayString()];
        case 'last30': return [daysAgo(29), todayString()];
        case 'month': return month ? [`${month}-01`, `${month}-31`] : [null, null];
        case 'range': return [from || null, to || null];
    }
};

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
    const [editingId, setEditingId] = useState<number | null>(null);
    // 直前に削除した出費（「元に戻す」用）
    const [undo, setUndo] = useState<DailyExpense | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>(loadSortKey);
    // 期間の絞り込みは下書きとして保存し、タブを切り替えたりリロードしても残す
    const [savedFilter] = useState(() => loadDraft<PeriodFilter>(userId, 'history-filter'));
    const [period, setPeriod] = useState<PeriodKey>(
        PERIOD_OPTIONS.some(o => o.key === savedFilter?.period) ? savedFilter!.period : 'all');
    const [periodMonth, setPeriodMonth] = useState<string>(savedFilter?.periodMonth || currentMonthString());
    const [rangeFrom, setRangeFrom] = useState<string>(savedFilter?.rangeFrom ?? daysAgo(29));
    const [rangeTo, setRangeTo] = useState<string>(savedFilter?.rangeTo ?? todayString());
    const [category, setCategory] = useState<string>(savedFilter?.category ?? ''); // '' はすべて

    const updateFilter = (patch: Partial<PeriodFilter>) => {
        const next = { period, periodMonth, rangeFrom, rangeTo, category, ...patch };
        if (patch.category !== undefined) setCategory(patch.category);
        if (patch.period !== undefined) setPeriod(patch.period);
        if (patch.periodMonth !== undefined) setPeriodMonth(patch.periodMonth);
        if (patch.rangeFrom !== undefined) setRangeFrom(patch.rangeFrom);
        if (patch.rangeTo !== undefined) setRangeTo(patch.rangeTo);
        saveDraft<PeriodFilter>(userId, 'history-filter', next);
    };

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

    const showUndo = (expense: DailyExpense | null) => {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndo(expense);
        if (expense) undoTimer.current = setTimeout(() => setUndo(null), 6000);
    };

    useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

    const handleDeleteExpense = async (expense: DailyExpense) => {
        setError(null);
        // 先に一覧から消して、すぐ反応したように見せる
        setExpenses(prev => prev.filter(e => e.expense_id !== expense.expense_id));
        setEditingId(null);
        try {
            // 月別出費の合計はバックエンドで自動再計算される
            await apiFetch<void>(`/api/expenses/${expense.expense_id}`, { method: 'DELETE' });
            showUndo(expense);
            onRefresh?.();
        } catch (err) {
            console.error('Delete error:', err);
            setExpenses(prev => [...prev, expense]);
            setError(errorMessage(err, '削除に失敗しました'));
        }
    };

    /** 削除を取り消す（同じ内容で登録し直す） */
    const handleUndo = async () => {
        if (!undo) return;
        const target = undo;
        showUndo(null);
        try {
            const restored = await apiFetch<DailyExpense>('/api/expenses', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: Number(userId),
                    expense_date: target.expense_date,
                    amount: target.amount,
                    category: target.category ?? null,
                }),
            });
            setExpenses(prev => [...prev, restored]);
            onRefresh?.();
        } catch (err) {
            setError(errorMessage(err, '元に戻せませんでした'));
        }
    };

    const handleSaved = (updated: DailyExpense) => {
        setExpenses(prev => prev.map(e => (e.expense_id === updated.expense_id ? updated : e)));
        setEditingId(null);
        onRefresh?.();
    };

    const month = currentMonthString();
    const monthTotal = expenses
        .filter(e => e.expense_date?.startsWith(month))
        .reduce((a, b) => a + b.amount, 0);

    // 期間で絞り込み（日付は YYYY-MM-DD なので文字列比較でよい）
    const [start, end] = periodRange(period, periodMonth, rangeFrom, rangeTo);
    const inPeriod = expenses.filter(e => {
        if (start === null && end === null) return true;
        if (!e.expense_date) return false;
        return (start === null || e.expense_date >= start) && (end === null || e.expense_date <= end);
    });

    // 期間内のカテゴリ別合計（金額の大きい順）
    const periodTotal = inPeriod.reduce((a, b) => a + b.amount, 0);
    const byCategory = Object.entries(
        inPeriod.reduce<Record<string, { total: number; count: number }>>((acc, e) => {
            const c = categoryOf(e.category);
            acc[c] = { total: (acc[c]?.total ?? 0) + e.amount, count: (acc[c]?.count ?? 0) + 1 };
            return acc;
        }, {}),
    ).sort((a, b) => b[1].total - a[1].total);

    // カテゴリで絞り込み
    const filtered = category ? inPeriod.filter(e => categoryOf(e.category) === category) : inPeriod;
    const filteredTotal = filtered.reduce((a, b) => a + b.amount, 0);
    const periodLabel =
        period === 'month' ? (periodMonth ? formatMonth(periodMonth) : '指定月')
        : period === 'range' ? '指定期間'
        : PERIOD_OPTIONS.find(o => o.key === period)?.label;
    const invalidRange = period === 'range' && start !== null && end !== null && start > end;

    const sorted = sortExpenses(filtered, sortKey);
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
            <div className="filters">
                <div className="field">
                    <label htmlFor="history-period">期間</label>
                    <select
                        id="history-period"
                        className="select"
                        value={period}
                        onChange={(e) => updateFilter({ period: e.target.value as PeriodKey })}
                    >
                        {PERIOD_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                </div>
                {period === 'month' && (
                    <div className="field">
                        <label htmlFor="history-month">月</label>
                        <input id="history-month" type="month" value={periodMonth} onChange={(e) => updateFilter({ periodMonth: e.target.value })} />
                    </div>
                )}
                {period === 'range' && (
                    <div className="range">
                        <div className="field">
                            <label htmlFor="history-from">開始日</label>
                            <input id="history-from" type="date" value={rangeFrom} max={rangeTo || undefined} onChange={(e) => updateFilter({ rangeFrom: e.target.value })} />
                        </div>
                        <span className="range-sep">〜</span>
                        <div className="field">
                            <label htmlFor="history-to">終了日</label>
                            <input id="history-to" type="date" value={rangeTo} min={rangeFrom || undefined} onChange={(e) => updateFilter({ rangeTo: e.target.value })} />
                        </div>
                    </div>
                )}
            </div>
            <div className="totals">
                {/* 期間が「今月」で絞り込みなしのときは右と同じ内容になるので出さない */}
                {!(period === 'thisMonth' && !category) && (
                    <div className="total-box"><span>今月の合計</span><b>{yen(monthTotal)}</b></div>
                )}
                <div className="total-box">
                    <span>{periodLabel}{category ? `・${category}` : ''}の合計（{filtered.length}件）</span>
                    <b>{yen(filteredTotal)}</b>
                </div>
            </div>
            {invalidRange && <p className="msg-error">開始日は終了日より前にしてください</p>}
            {byCategory.length > 0 && (
                <div className="category-breakdown">
                    <div className="category-breakdown-head">
                        <span>カテゴリ別（タップで絞り込み）</span>
                        {category && (
                            <button type="button" className="link-btn" onClick={() => updateFilter({ category: '' })}>すべて表示</button>
                        )}
                    </div>
                    <ul>
                        {byCategory.map(([name, v]) => {
                            const ratio = periodTotal > 0 ? v.total / periodTotal : 0;
                            return (
                                <li key={name}>
                                    <button
                                        type="button"
                                        className={`category-row${category === name ? ' selected' : ''}`}
                                        aria-pressed={category === name}
                                        onClick={() => updateFilter({ category: category === name ? '' : name })}
                                    >
                                        <span className="category-name">{name}</span>
                                        <span className="category-bar"><span style={{ width: `${ratio * 100}%` }} /></span>
                                        <span className="category-amount">{yen(v.total)}</span>
                                        <span className="category-ratio">{Math.round(ratio * 100)}%</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {error && <p className="msg-error">{error}</p>}
            {loading ? (
                <p className="empty">読み込み中…</p>
            ) : expenses.length === 0 ? (
                <p className="empty">出費がありません</p>
            ) : inPeriod.length === 0 ? (
                <p className="empty">この期間の出費はありません</p>
            ) : filtered.length === 0 ? (
                <p className="empty">この期間に「{category}」の出費はありません</p>
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
                                editingId === expense.expense_id ? (
                                    <li key={expense.expense_id} className="history-edit">
                                        <ExpenseEditRow
                                            userId={userId}
                                            expense={expense}
                                            onSaved={handleSaved}
                                            onCancel={() => setEditingId(null)}
                                            onDelete={() => handleDeleteExpense(expense)}
                                        />
                                    </li>
                                ) : (
                                    <li key={expense.expense_id} className="history-item">
                                        <button
                                            type="button"
                                            className="history-row"
                                            aria-label={`${expense.expense_date}の${categoryOf(expense.category)} ${expense.amount}円を編集`}
                                            onClick={() => setEditingId(expense.expense_id)}
                                        >
                                            <span className="history-date">{formatDate(expense.expense_date, !byDate)}</span>
                                            <span className={`category-badge${expense.category ? '' : ' none'}`}>{categoryOf(expense.category)}</span>
                                            <span className="history-amount">{yen(expense.amount)}</span>
                                            <span className="history-chevron" aria-hidden="true">›</span>
                                        </button>
                                    </li>
                                )
                            ))}
                        </React.Fragment>
                    ))}
                </ul>
            )}
            {undo && (
                <div className="toast" role="status">
                    <span>{undo.category ? `「${undo.category}」` : ''}{yen(undo.amount)}を削除しました</span>
                    <button type="button" className="link-btn" onClick={handleUndo}>元に戻す</button>
                </div>
            )}
        </section>
    );
};
