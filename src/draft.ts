// 入力途中の内容（下書き）をブラウザに保存し、リロードやタブ切り替えで消えないようにする。
// サーバーへの保存が成功したら clearDraft で消す。ログアウト時は clearAllDrafts で全部消す。

const PREFIX = 'kakeibo:draft:';

const keyOf = (userId: string, name: string) => `${PREFIX}${userId}:${name}`;

export function loadDraft<T>(userId: string, name: string): T | null {
    try {
        const raw = localStorage.getItem(keyOf(userId, name));
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

export function saveDraft<T>(userId: string, name: string, value: T): void {
    try {
        localStorage.setItem(keyOf(userId, name), JSON.stringify(value));
    } catch {
        // 容量超過やプライベートモードでは保存しない（入力自体はそのまま続けられる）
    }
}

export function clearDraft(userId: string, name: string): void {
    try {
        localStorage.removeItem(keyOf(userId, name));
    } catch {
        // 何もしない
    }
}

export function clearAllDrafts(): void {
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX))
            .forEach(k => localStorage.removeItem(k));
    } catch {
        // 何もしない
    }
}
