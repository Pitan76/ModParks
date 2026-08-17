"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import { CHECKBOX_ABSENT_VALUE } from "@/lib/forms/formReader";

interface SwitchFieldProps {
  name: string;
  label: string;
  defaultChecked?: boolean;
  onChange?: () => void;
}

/**
 * 部分更新のフォームで使う on/off スイッチ。
 *
 * 未チェックのスイッチは何も送信しないため、素のまま使うと受け側が
 * 「オフ」と「この画面には無い項目」を区別できない。同名の hidden を
 * 添えることで、送信された事実だけは必ず届くようにしている。
 * 受け側は `FormReader#checkbox` で読むこと。
 */
export default function SwitchField({ name, label, defaultChecked = false, onChange }: SwitchFieldProps) {
  return (
    <>
      <input type="hidden" name={name} value={CHECKBOX_ABSENT_VALUE} />
      <FormControlLabel
        control={<Switch name={name} defaultChecked={defaultChecked} onChange={onChange} />}
        label={label}
      />
    </>
  );
}
