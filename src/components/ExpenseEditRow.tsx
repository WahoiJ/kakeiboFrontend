import React, { useState } from "react";
import { apiFetch, errorMessage, type DailyExpense } from "../api";
import { CategoryPicker } from "./CategoryPicker";
import { DateQuickPicker } from "./DateQuickPicker";

interface Props {
    userId: string;
    expense: DailyExpense;
    onSaved: (updated: DailyExpense) => void;
    onCancel: () => void;
    onDelete: () => void;
}

/** 履歴の1件をその場で編集する */
export const ExpenseEditRow: React.FC<Props> = ({ userId, expense, onSaved, onCancel, onDelete }) => {
    const [amount, setAmount] = useState(String(expense.amount));
    const [date, setDate] = useState(expense.expense_date ?? '');
    const [category, setCategory] = useState(expense.category ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const updated = await apiFetch<DailyExpense>(`/api/expenses/${expense.expense_id}`, {
                method: 'PUT',
                body: JSON.stringify({ amount: Number(amount), expense_date: date, category: category || null }),
            });
            onSaved(updated);
        } catch (err) {
            setError(errorMessage(err, '更新に失敗しました'));
            setSaving(false);
        }
    };

    return (
        <form className="form edit-form" onSubmit={save}>
            <div className="field">
                <label htmlFor={`edit-amount-${expense.expense_id}`}>金額</label>
                <div className="input-suffix">
                    <input
                        id={`edit-amount-${expense.expense_id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={amount}
                        autoFocus
                        onChange={(e) => setAmount(e.target.value)}
                        required
                    />
                    <span>円</span>
                </div>
            </div>
            <CategoryPicker userId={userId} value={category} onChange={setCategory} showHint={false} />
            <DateQuickPicker id={`edit-date-${expense.expense_id}`} value={date} onChange={setDate} />
            {error && <p className="msg-error">{error}</p>}
            <div className="edit-actions">
                <button type="button" className="btn btn-danger" onClick={onDelete}>削除</button>
                <span className="spacer" />
                <button type="button" className="btn btn-ghost" onClick={onCancel}>キャンセル</button>
                <button type="submit" className="btn btn-primary btn-inline" disabled={saving || !(Number(amount) > 0) || !date}>
                    {saving ? '保存中…' : '保存'}
                </button>
            </div>
        </form>
    );
};
