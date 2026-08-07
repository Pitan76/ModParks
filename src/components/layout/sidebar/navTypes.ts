/** サイドバーの見た目と項目の型。ヘッダーや本文の幅計算からも参照される */

export const SIDEBAR_WIDTH = 260;

export type NavItem = {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  children?: Omit<NavItem, "children">[];
};

/**
 * 選択中の項目かを判定する。
 *
 * 「すべて」と「自分の」は同じ /projects を指し、author=me の有無だけが違う。
 * パス一致だけでは両方が同時に選択状態になるため、この2つは個別に見る。
 */
export const getIsSelected = (
  itemId: string,
  itemPath: string,
  pathname: string,
  isMyProjects: boolean,
): boolean => {
  if (itemId === "projects") return pathname === "/projects" && !isMyProjects;
  if (itemId === "myProjects") return pathname === "/projects" && isMyProjects;
  return pathname === itemPath;
};
