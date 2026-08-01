"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Updater<V> = V | ((prev: V) => V);

/**
 * 「値を変えたら保存バーが浮き上がる」設定系フォームの共通フック。
 *
 * 保存済みの値（baseline）と編集中の値を持ち、その差分で dirty を判定する。
 * 保存に成功した時点で baseline を更新するので、保存ボタンは自動的に引っ込む。
 */
export function useDirtyForm<T extends Record<string, unknown>>(
  initial: T,
  onSave: (values: T) => Promise<unknown> | unknown
) {
  const [baseline, setBaseline] = useState<T>(initial);
  const [values, setValues] = useState<T>(initial);
  const [saving, setSaving] = useState(false);

  // onSave は毎レンダー新しい関数になりがちなので、submit の同一性を保つため ref に逃がす
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const valuesRef = useRef(values);
  valuesRef.current = values;

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(baseline), [values, baseline]);

  const setField = useCallback(<K extends keyof T>(key: K, value: Updater<T[K]>) => {
    setValues((prev) => ({
      ...prev,
      [key]: typeof value === "function" ? (value as (p: T[K]) => T[K])(prev[key]) : value,
    }));
  }, []);

  const reset = useCallback(() => setValues(baseline), [baseline]);

  /**
   * 外部（localStorage やストア）から取り込んだ値を「保存済み」として採用する。
   * 初期値をクライアント側でしか読めないフォーム向け。
   */
  const commit = useCallback((next: Updater<T>) => {
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(valuesRef.current) : next;
    valuesRef.current = resolved;
    setValues(resolved);
    setBaseline(resolved);
  }, []);

  /** 現在値を保存する。onSave が false を返した場合は失敗扱いで dirty を維持する */
  const submit = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const snapshot = valuesRef.current;
      const result = await onSaveRef.current(snapshot);
      if (result !== false) setBaseline(snapshot);
    } finally {
      setSaving(false);
    }
  }, [saving]);

  return { values, setField, setValues, dirty, saving, reset, commit, submit, baseline };
}
