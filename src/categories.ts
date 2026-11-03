// 出費のカテゴリ

export const PRESET_CATEGORIES = ['食費', '外食', '日用品', '交通費', '娯楽', '交際費', '衣服・美容', '医療', 'その他'];

export const UNCATEGORIZED = '未分類';

export const MAX_CATEGORY_LENGTH = 20;

export const categoryOf = (c: string | null | undefined): string => (c && c.trim() ? c.trim() : UNCATEGORIZED);

const customKey = (userId: string) => `kakeibo:categories:${userId}`;

/** 自分で追加したカテゴリ（よく使う順に最大10個）を端末に保存しておく */
export function loadCustomCategories(userId: string): string[] {
    try {
        const raw = localStorage.getItem(customKey(userId));
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string') : [];
    } catch {
        return [];
    }
}

export function rememberCustomCategory(userId: string, category: string): string[] {
    const c = category.trim();
    const current = loadCustomCategories(userId);
    if (!c || PRESET_CATEGORIES.includes(c)) return current;
    const next = [c, ...current.filter(x => x !== c)].slice(0, 10);
    try {
        localStorage.setItem(customKey(userId), JSON.stringify(next));
    } catch {
        // 保存できなくても入力は続けられる
    }
    return next;
}
