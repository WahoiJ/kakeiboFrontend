import React, { useState } from "react";
import { loadCustomCategories, MAX_CATEGORY_LENGTH, PRESET_CATEGORIES, rememberCustomCategory } from "../categories";

interface Props {
    userId: string;
    value: string;
    onChange: (category: string) => void;
    /** 説明文を表示するか */
    showHint?: boolean;
}

/** カテゴリを選ぶチップ。自分で追加したカテゴリも端末に覚えておく */
export const CategoryPicker: React.FC<Props> = ({ userId, value, onChange, showHint = true }) => {
    const [custom, setCustom] = useState<string[]>(() => loadCustomCategories(userId));
    const [input, setInput] = useState('');
    const [adding, setAdding] = useState(false);

    const choices = [...PRESET_CATEGORIES, ...custom.filter(c => !PRESET_CATEGORIES.includes(c))];
    if (value && !choices.includes(value)) choices.push(value);

    const add = () => {
        const c = input.trim().slice(0, MAX_CATEGORY_LENGTH);
        if (!c) return;
        setCustom(rememberCustomCategory(userId, c));
        onChange(c);
        setInput('');
        setAdding(false);
    };

    return (
        <fieldset className="field category-field">
            <legend>カテゴリ</legend>
            <div className="chips" role="radiogroup" aria-label="カテゴリ">
                {choices.map(c => (
                    <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={value === c}
                        className={`chip chip-select${value === c ? ' selected' : ''}`}
                        onClick={() => onChange(value === c ? '' : c)}
                    >
                        {c}
                    </button>
                ))}
                <button type="button" className="chip" aria-expanded={adding} onClick={() => setAdding(v => !v)}>＋ 追加</button>
            </div>
            {adding && (
                <div className="custom-category">
                    <input
                        aria-label="新しいカテゴリ名"
                        type="text"
                        placeholder="例: ペット、趣味"
                        maxLength={MAX_CATEGORY_LENGTH}
                        value={input}
                        autoFocus
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                    />
                    <button type="button" className="btn btn-ghost" onClick={add} disabled={!input.trim()}>追加</button>
                </div>
            )}
            {showHint && <span className="hint">{value ? `「${value}」として記録します` : '選ばない場合は「未分類」になります'}</span>}
        </fieldset>
    );
};
