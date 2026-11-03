// API 呼び出しと日付処理の共通モジュール

export const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type DailyExpense = {
    expense_id: number;
    user_id: number;
    expense_date: string | null;
    amount: number;
};

export type FixedCostItem = {
    name: string;
    amount: number;
};

export type MonthlyBudget = {
    user_id: number;
    budget_month: string;
    available_amount: number;
    /** 逆算モードのときのみ値が入る（直接入力の場合は null） */
    income?: number | null;
    fixed_costs?: number | null;
    /** 固定費の内訳（合計だけ入力した古いデータは null） */
    fixed_cost_items?: FixedCostItem[] | null;
    savings_goal?: number | null;
};

export type MonthlyExpenses = {
    user_id: number;
    budget_month: string;
    amount: number;
};

/** 認証切れ時に発火するイベント名（App が受け取ってログアウトする） */
export const AUTH_EXPIRED_EVENT = 'kakeibo:auth-expired';

export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

/** トークン付きで API を呼び出し、JSON を返す。401 の場合はログアウトさせる */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        if (res.status === 401) {
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        }
        const message =
            data && typeof data === 'object' && 'message' in data
                ? String((data as { message: unknown }).message)
                : `HTTP error! status: ${res.status}`;
        throw new ApiError(res.status, message);
    }
    return data as T;
}

/** axios のエラーからバックエンドの message を取り出す */
export function errorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        if (res?.data?.message) return res.data.message;
    }
    if (err instanceof ApiError) return err.message;
    return fallback;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** ローカル時刻での今日 "YYYY-MM-DD"（toISOString は UTC のため日本時間の朝に前日になる） */
export function todayString(d: Date = new Date()): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** ローカル時刻での当月 "YYYY-MM" */
export function currentMonthString(d: Date = new Date()): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** 金額を "1,234円" 形式で表示 */
export function yen(n: number): string {
    return `${Math.round(n).toLocaleString('ja-JP')}円`;
}
