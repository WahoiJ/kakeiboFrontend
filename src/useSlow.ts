import { useEffect, useState } from "react";

/** active が ms ミリ秒以上続いたら true を返す（無料サーバーの起動待ちの案内に使う） */
export function useSlow(active: boolean, ms = 4000): boolean {
    const [slow, setSlow] = useState(false);
    useEffect(() => {
        if (!active) {
            setSlow(false);
            return;
        }
        const t = setTimeout(() => setSlow(true), ms);
        return () => clearTimeout(t);
    }, [active, ms]);
    return slow;
}

export const SLOW_SERVER_MESSAGE = 'サーバーを起動しています。しばらく使っていないと最大1分ほどかかります…';
