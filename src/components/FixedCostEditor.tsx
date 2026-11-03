import React from "react";
import { yen } from "../api";
import { FIXED_COST_PRESETS, newRow, type FixedCostRow } from "../fixedCosts";

interface Props {
    rows: FixedCostRow[];
    onChange: (rows: FixedCostRow[]) => void;
}

export const FixedCostEditor: React.FC<Props> = ({ rows, onChange }) => {
    const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const usedNames = new Set(rows.map(r => r.name.trim()));

    const update = (id: number, patch: Partial<FixedCostRow>) =>
        onChange(rows.map(r => (r.id === id ? { ...r, ...patch } : r)));

    const remove = (id: number) => {
        const rest = rows.filter(r => r.id !== id);
        onChange(rest.length > 0 ? rest : [newRow()]);
    };

    const addPreset = (name: string) => {
        // 名前も金額も空の行があればそこを使う
        const blank = rows.find(r => r.name.trim() === '' && r.amount === '');
        if (blank) update(blank.id, { name });
        else onChange([...rows, newRow(name)]);
    };

    return (
        <fieldset className="field fixed-costs">
            <legend>固定費</legend>
            <span className="hint">毎月決まって出ていくお金を項目ごとに入力します</span>
            <ul className="fixed-list">
                {rows.map((r, i) => (
                    <li key={r.id} className="fixed-row">
                        <input
                            aria-label={`固定費${i + 1}の項目名`}
                            type="text"
                            placeholder="項目名"
                            maxLength={50}
                            value={r.name}
                            onChange={(e) => update(r.id, { name: e.target.value })}
                        />
                        <div className="input-suffix">
                            <input
                                aria-label={`固定費${i + 1}の金額`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                placeholder="0"
                                value={r.amount}
                                onChange={(e) => update(r.id, { amount: e.target.value })}
                            />
                            <span>円</span>
                        </div>
                        <button
                            type="button"
                            className="btn btn-danger icon-btn"
                            aria-label={`${r.name || `固定費${i + 1}`}を削除`}
                            onClick={() => remove(r.id)}
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>
            <div className="chips">
                {FIXED_COST_PRESETS.filter(p => !usedNames.has(p)).map(p => (
                    <button key={p} type="button" className="chip" onClick={() => addPreset(p)}>＋ {p}</button>
                ))}
                <button type="button" className="chip" onClick={() => onChange([...rows, newRow()])}>＋ 項目を追加</button>
            </div>
            <div className="fixed-total"><span>固定費の合計</span><b>{yen(total)}</b></div>
        </fieldset>
    );
};
