import MultiChipAutocomplete from "@/components/ui/form/MultiChipAutocomplete";
import { LICENSE_OPTIONS } from "@/lib/licenses";

/**
 * @typedef {Object} LicenseAutocompleteProps
 * @property {string[]} value - 選択されたライセンスの配列
 * @property {function(string[]): void} onChange - ライセンスの選択状態が変化した際のコールバック関数
 * @property {string} label - ラベルテキスト
 * @property {"small" | "medium"} [size] - コンポーネントのサイズ
 * @property {boolean} [error] - エラー状態の有無
 * @property {string} [helperText] - ヘルパーテキスト
 * @property {boolean} [required] - 必須フィールドか否か
 */
export type LicenseAutocompleteProps = {
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  size?: "small" | "medium";
  error?: boolean;
  helperText?: string;
  required?: boolean;
};

/**
 * ライセンスの複数選択用オートコンプリートコンポーネント。
 * 高度な検索などで、ユーザーが複数のライセンスを指定してフィルタリングするために使用します。
 *
 * @param {LicenseAutocompleteProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element}
 */
export default function LicenseAutocomplete({
  value,
  onChange,
  ...props
}: LicenseAutocompleteProps) {
  return (
    <MultiChipAutocomplete
      {...props}
      options={LICENSE_OPTIONS as unknown as string[]}
      value={value}
      onChange={onChange}
      getLabel={(val) => val}
    />
  );
}
