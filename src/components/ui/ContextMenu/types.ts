import type * as React from "react";

/**
 * 右クリックされた対象の情報。
 * items をコールバックで渡した場合や、各項目の onClick に渡される。
 */
export interface ContextMenuTarget {
  /** 元の onContextMenu イベント */
  event: React.MouseEvent;
  /** 実際に右クリックされた DOM ノード */
  node: HTMLElement;
  /** 直近の a[href]（あれば） */
  link: HTMLAnchorElement | null;
  /** 直近の img（あれば） */
  image: HTMLImageElement | null;
  /** 右クリック時点で選択されていたテキスト（無ければ ""） */
  selectionText: string;
  /** input / textarea / contenteditable 内なら true */
  editable: boolean;
}

export interface ContextMenuActionItem {
  type?: "item";
  /** React key・自動テスト用の id */
  id?: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** 右側に淡色で表示するショートカット等 */
  shortcut?: React.ReactNode;
  disabled?: boolean;
  /** 破壊的操作（削除など）を赤系で表示 */
  danger?: boolean;
  /** クリック時の処理。指定すれば onClick 後にメニューを閉じる */
  onClick?: (target: ContextMenuTarget) => void;
  /** 指定すると内部リンクとして遷移する（onClick より優先） */
  href?: string;
}

export interface ContextMenuDivider {
  type: "divider";
}

export type ContextMenuItem = ContextMenuActionItem | ContextMenuDivider;

/** 配列、または対象情報から動的に組み立てる関数 */
export type ContextMenuItems =
  | ContextMenuItem[]
  | ((target: ContextMenuTarget) => ContextMenuItem[]);

export interface ContextMenuPassthrough {
  /** a[href] 上ではネイティブメニューを優先（既定: true） */
  links?: boolean;
  /** img 上ではネイティブメニューを優先（既定: true） */
  images?: boolean;
  /** テキスト選択中はネイティブメニューを優先（既定: true） */
  selection?: boolean;
  /** input/textarea/contenteditable 上ではネイティブメニューを優先（既定: true） */
  editable?: boolean;
}

export interface UseContextMenuOptions {
  /**
   * ネイティブ（Chrome）メニューへ素通しする条件。
   * Shift+右クリックは常に素通しされる（この設定に関わらず）。
   */
  passthrough?: ContextMenuPassthrough;
  /** メニュー末尾に「ブラウザ標準メニュー」への案内項目を出す（既定: true） */
  includeBrowserItem?: boolean;
}
