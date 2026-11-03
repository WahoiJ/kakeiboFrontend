import React from "react";
import { todayString } from "../api";

const daysAgo = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return todayString(d);
};

interface Props {
    id: string;
    value: string;
    onChange: (date: string) => void;
}

/** 「今日・昨日・おととい」をワンタップで選べる日付入力 */
export const DateQuickPicker: React.FC<Props> = ({ id, value, onChange }) => {
    const quick = [
        { label: '今日', date: daysAgo(0) },
        { label: '昨日', date: daysAgo(1) },
        { label: 'おととい', date: daysAgo(2) },
    ];
    return (
        <div className="field">
            <label htmlFor={id}>日付</label>
            <div className="date-quick">
                <div className="chips" role="radiogroup" aria-label="日付をすばやく選ぶ">
                    {quick.map(q => (
                        <button
                            key={q.label}
                            type="button"
                            role="radio"
                            aria-checked={value === q.date}
                            className={`chip chip-select${value === q.date ? ' selected' : ''}`}
                            onClick={() => onChange(q.date)}
                        >
                            {q.label}
                        </button>
                    ))}
                </div>
                <input id={id} type="date" value={value} max={daysAgo(0)} onChange={(e) => onChange(e.target.value)} required />
            </div>
        </div>
    );
};
