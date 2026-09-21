/**
 * シークレット値の表示機能（lib/actions/revealSecret.ts）の有効・無効。
 *
 * "use server" のファイルは async 関数しか export できないので、ここに分けている。
 *
 * 環境変数にせずコードに置いている。管理画面から変数を書き換えられるため、
 * 環境変数だと管理者権限さえあればデプロイなしに復活させられてしまう。
 * 有効に戻すにはコードの変更とデプロイを必須にしておく。
 */
export const SECRET_REVEAL_ENABLED = false;
