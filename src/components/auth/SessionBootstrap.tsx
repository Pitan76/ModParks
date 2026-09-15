"use client";

import { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { readSessionSnapshot, writeSessionSnapshot } from "@/lib/auth/sessionSnapshot";

/**
 * ページ HTML をセッション非依存に保ったまま、ログイン状態を描画へ戻す。
 *
 * サーバで auth() を呼ぶと配下の全ルートが動的描画になり、共有キャッシュにも
 * 載せられなくなる。ここではブラウザに残した控えを初期値として渡し、
 * 控えが無いときだけ SessionProvider に取得させる。
 */

/** 取得できたセッションを控えへ写す。描画はしない */
const SnapshotWriter = ({ children }: { children: React.ReactNode }) => {
  const { data, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    writeSessionSnapshot(data ?? null);
  }, [data, status]);

  return <>{children}</>;
};

/**
 * 控えの読み出しはブラウザでしか行えないため、初回描画はサーバと同じ
 * 「未確定」の状態から始める。確定後に SessionProvider が差し替える。
 */
const SessionBootstrap = ({ children }: { children: React.ReactNode }) => {
  // undefined を渡すと SessionProvider が自分で取りに行く。null は「未ログイン確定」の意味になる
  const initial = typeof window === "undefined" ? undefined : readSessionSnapshot();

  return (
    <SessionProvider session={initial} refetchOnWindowFocus={false}>
      <SnapshotWriter>{children}</SnapshotWriter>
    </SessionProvider>
  );
};

export default SessionBootstrap;
