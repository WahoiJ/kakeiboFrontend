import React, { useState } from "react";
import { apiFetch, errorMessage, todayString, yen, type DailyExpense } from "../api";

const TEMP_KEY = 'tempMoney'; // 送信失敗時に入力額を一時保存するキー

interface ExpenseFormProps {
    userId: string;
    onAddExpense?: (newExpense: DailyExpense) => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ userId, onAddExpense }) => {
    const [expenseDate, setExpenseDate] = useState<string>(todayString());
    const [amount, setAmount] = useState<string>(localStorage.getItem(TEMP_KEY) || '');
    const [isSending, setIsSending] = useState<boolean>(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const amountNumber = Number(amount);

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
                }),
            });
            localStorage.removeItem(TEMP_KEY);
            setExpenseDate(todayString());
            setAmount('');
            setMessage({ type: 'success', text: `${newExpense.expense_date} に ${yen(newExpense.amount)} を追加しました` });
            onAddExpense?.(newExpense);
        } catch (error) {
            localStorage.setItem(TEMP_KEY, amount);
            console.error('Error adding expense:', error);
            setMessage({ type: 'error', text: '出費の追加に失敗しました: ' + errorMessage(error, (error as Error).message) });
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
                            type="number"
                            inputMode="numeric"
                            min={1}
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                        <span>円</span>
                    </div>
                </div>
                <div className="field">
                    <label htmlFor="expense-date">日付</label>
                    <input
                        id="expense-date"
                        type="date"
                        value={expenseDate}
                        onChange={(e) => setExpenseDate(e.target.value)}
                        required
                    />
                </div>
                {message && <p className={message.type === 'success' ? 'msg-success' : 'msg-error'}>{message.text}</p>}
                <button className="btn btn-primary" type="submit" disabled={!(amountNumber > 0) || isSending}>
                    {isSending ? '送信中…' : '追加する'}
                </button>
            </form>
        </section>
    );
};
