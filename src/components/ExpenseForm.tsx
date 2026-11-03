import React, { useEffect, useRef, useState } from "react";
import { apiFetch, errorMessage, todayString, yen, type DailyExpense } from "../api";
import { clearDraft, loadDraft, saveDraft } from "../draft";
import { CategoryPicker } from "./CategoryPicker";
import { DateQuickPicker } from "./DateQuickPicker";

interface ExpenseFormProps {
    userId: string;
    onAddExpense?: (newExpense: DailyExpense) => void;
}

type ExpenseDraft = { amount: string; date: string; category?: string; savedOn: string };

/** 下書きを読み込む。日付は「今日入力した下書き」のときだけ復元し、翌日以降は今日にする */
const initialDraft = (userId: string): { amount: string; date: string; category: string } => {
    const today = todayString();
    const lastCategory = loadDraft<string>(userId, 'last-category') ?? '';
    const draft = loadDraft<ExpenseDraft>(userId, 'expense');
    if (draft) {
        return {
            amount: draft.amount ?? '',
            date: draft.savedOn === today && draft.date ? draft.date : today,
            category: draft.category ?? lastCategory,
        };
    }
    // 旧バージョンの一時保存（tempMoney）があれば引き継ぐ
    const legacy = localStorage.getItem('tempMoney');
    if (legacy) {
        localStorage.removeItem('tempMoney');
        return { amount: Number(legacy) > 0 ? legacy : '', date: today, category: lastCategory };
    }
    return { amount: '', date: today, category: lastCategory };
};

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ userId, onAddExpense }) => {
    const [initial] = useState(() => initialDraft(userId));
    const [expenseDate, setExpenseDate] = useState<string>(initial.date);
    const [amount, setAmount] = useState<string>(initial.amount);
    const [category, setCategory] = useState<string>(initial.category);
    const [isSending, setIsSending] = useState<boolean>(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const amountNumber = Number(amount);
    const amountRef = useRef<HTMLInputElement>(null);

    // 成功メッセージは数秒で消す
    useEffect(() => {
        if (message?.type !== 'success') return;
        const t = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(t);
    }, [message]);

    const update = (next: { amount?: string; date?: string; category?: string }) => {
        const a = next.amount ?? amount;
        const d = next.date ?? expenseDate;
        const c = next.category ?? category;
        if (next.amount !== undefined) setAmount(a);
        if (next.date !== undefined) setExpenseDate(d);
        if (next.category !== undefined) setCategory(c);
        if (a === '' && d === todayString()) clearDraft(userId, 'expense');
        else saveDraft<ExpenseDraft>(userId, 'expense', { amount: a, date: d, category: c, savedOn: todayString() });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSending) return;
        setIsSending(true);
        setMessage(null);
        try {
            // 日々の出費を追加（月別出費の合計はバックエンドで自動再計算される）
            const newExpense = await apiFetch<DailyExpense>('/api/expenses', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: Number(userId),
                    expense_date: expenseDate,
                    amount: amountNumber,
                    category: category || null,
                }),
            });
            clearDraft(userId, 'expense');
            // 次の入力でも同じカテゴリを選んだ状態にしておく
            saveDraft<string>(userId, 'last-category', category);
            setExpenseDate(todayString());
            setAmount('');
            setMessage({
                type: 'success',
                text: `${newExpense.expense_date} に${newExpense.category ? `「${newExpense.category}」` : ''} ${yen(newExpense.amount)} を追加しました`,
            });
            onAddExpense?.(newExpense);
            // 続けて入力できるように金額欄にフォーカスを戻す
            amountRef.current?.focus();
        } catch (error) {
            // 入力内容は下書きとして残っているので、そのまま再送できる
            console.error('Error adding expense:', error);
            setMessage({ type: 'error', text: '出費の追加に失敗しました（入力内容は残っています）: ' + errorMessage(error, (error as Error).message) });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <section className="card">
            <h2 className="card-title">出費を入力する</h2>
            <form className="form" onSubmit={handleSubmit}>
                <div className="field">
                    <label htmlFor="expense-amount">金額</label>
                    <div className="input-suffix">
                        <input
                            id="expense-amount"
                            ref={amountRef}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            placeholder="0"
                            value={amount}
                            onChange={(e) => update({ amount: e.target.value })}
                            required
                        />
                        <span>円</span>
                    </div>
                </div>
                <CategoryPicker userId={userId} value={category} onChange={(c) => update({ category: c })} />
                <DateQuickPicker id="expense-date" value={expenseDate} onChange={(d) => update({ date: d })} />
                {message && <p className={message.type === 'success' ? 'msg-success' : 'msg-error'}>{message.text}</p>}
                <button className="btn btn-primary" type="submit" disabled={!(amountNumber > 0) || isSending}>
                    {isSending ? '送信中…' : '追加する'}
                </button>
            </form>
        </section>
    );
};
