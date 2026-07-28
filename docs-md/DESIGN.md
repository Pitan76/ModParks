# システム設計: Postに関する再設計
本ドキュメントは、`Post`（投稿）のデータベーススキーマとUIコンポーネントレイヤーの再設計に関する設計書です。

`Project`（プロジェクト）と`Idea`（アイデア）を`Post`の一形態として再構築し、コメントやいいねなどのアクションを`Post`の子アソシエーションとして整理することで、重複したデータベーステーブルを排除し、フロントエンドコンポーネントを共通化し、高い拡張性を持つシステムを実現します。

## 1. ドメイン概念モデル

本設計では、エンティティの関係性をクリーンなオブジェクト指向関係（is-a および has-a）で分類します。

- `Post` (基底エンティティ): ユーザーが生成するすべての公開コンテンツに共通するコアメタデータを保持します。
- `Project` & `Idea` (具象エンティティ): `Post`を継承し、それぞれのドメイン固有のフィールドを保持します。
- `Comment` & `Like` (関連エンティティ): `postId` 外部キーを介して、特定の `Post` に属します。ブックマークも「お気に入り」や「いいね」と同じ仕組み（ユーザーとPostの多対多の紐づけ）として統一的に設計します。
(名前を全て「お気に入り」に統一する。いいねマークは使わず、ブックマークのアイコンにする)

```text
       ┌──────────┐
       │   Post   │
       └────┬─────┘
            │
      ┌─────┴─────┐
      ▼           ▼
 ┌─────────┐ ┌─────────┐
 │ Project │ │  Idea   │
 └─────────┘ └─────────┘
      │           │
      └─────┬─────┘
            ▼
     ┌─────────────┐
     │ 関連エンティティ│ (例: Comment, Like/お気に入り)
     └─────────────┘
```

---

## 2. データベーススキーマ設計 (SQLite & Drizzle)

ここでは Class Table Inheritance (CTI: 区分テーブル継承) パターンを採用します。共通フィールドはベースとなる `posts` テーブルに配置し、サブクラスである `projects` および `ideas` テーブルは primary key を `posts.id` に対する外部キーとして共有することで、厳格な 1:1 の関係を構築します。

また、いいね（Like）とブックマーク（お気に入り）はデータ構造上「どのユーザーがどのPostを選択したか」という多対多（M:N）の関連であり同一であるため、単一の `likes` テーブル（または `post_interactions` テーブル）に統合します。将来的に機能として区別する必要が出た場合は、`type` カラム（'like' | 'bookmark'）を追加して対応します。(いいえ、区別する必要はありません)

```mermaid
erDiagram
    posts {
        text id PK
        text author_id FK
        text type "project | idea | update"
        timestamp created_at
        timestamp updated_at
    }
    projects {
        text id PK, FK "references posts(id)"
        text slug UNIQUE
        text name
        text description
    }
    ideas {
        text id PK, FK "references posts(id)"
        text title
        text content
        text status "open | in_progress | fulfilled"
    }
    comments {
        text id PK
        text post_id FK "references posts(id)"
        text parent_id FK "references comments(id)"
        text author_id FK
        text content
        text content_format
        timestamp created_at
        timestamp updated_at
    }
    likes {
        text post_id PK, FK "references posts(id)"
        text user_id PK, FK "references users(id)"
        text type "like | bookmark"
        timestamp created_at
    }

    posts ||--|| projects : "inherits (1:1)"
    posts ||--|| ideas : "inherits (1:1)"
    posts ||--o{ comments : "has-many (1:N)"
    posts ||--o{ likes : "has-many (1:N)"
```

### 2.1. スキーマ実装コード例

```typescript
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./schema/users"; // スキーマ分割方式または直接インポートを想定

// 1. 基底 Post テーブル
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["project", "idea"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// 2. 具象 Project テーブル (CTI)
export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  // プロジェクト固有の他のフィールド...
});

// 3. 具象 Idea テーブル (CTI)
export const ideas = sqliteTable("ideas", {
  id: text("id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["open", "in_progress", "fulfilled"] })
    .notNull()
    .default("open"),
});

// 4. 統合コメントテーブル
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  contentFormat: text("content_format", { enum: ["markdown", "plaintext", "pukiwiki"] })
    .notNull()
    .default("markdown"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  postIdx: index("comments_post_idx").on(t.postId),
  authorIdx: index("comments_author_idx").on(t.authorId),
}));

// 5. 統合インタラクションテーブル（Like/お気に入り）
export const likes = sqliteTable("likes", {
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["like", "bookmark"] }).notNull().default("like"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.userId, t.type] }),
  postIdx: index("likes_post_idx").on(t.postId),
  userIdx: index("likes_user_idx").on(t.userId),
}));
```

---

## 3. UI コンポーネントのアーキテクチャ設計

データベースの継承モデルを TypeScript の型定義に写像することで、コンポーネントは重複したドメインモデルではなく、抽象化されたインターフェースを消費できます。

```typescript
// types/post.ts
export interface Post {
  id: string;
  authorId: string;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorUsername?: string | null;
  content: string;
  contentFormat: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}
```

### 3.1. レイヤー構成

1. **プレゼンテーション層 (Core コンポーネント)**:
   - 抽象化された Post および Comment プロパティを受け取ります。
   - 例: CommentSection は comments: Comment[] を受け取り、汎用的なアクションのトリガー（onSubmitComment や onEditComment など）をコールバックとして露出します。
2. **コントローラー層 (Adapter コンポーネント)**:
   - プロジェクトやアイデアに特化したデータを取得します。
   - プラットフォームに依存する動作（Server Actions、React Server Components、クライアント側のルートハンドラー呼び出しなど）をバインドし、データを Core インターフェースに適合する形状に変換（アダプト）して渡します。
   - 例: ProjectComments は、/api/v1/projects/[slug]/comments からデータをフェッチし、汎用の CommentSection へ流し込むコントローラーとして動作します。

---

## 4. データ移行計画 (Migration Plan)

既存の稼働中データをこの CTI 設計へ移行する手順は以下の通りです。

### フェーズ 1: 新規テーブルの作成
1. スキーマ移行（Migration）を実行し、posts テーブル、新しい統一 comments テーブル、統一 likes テーブルを作成します。
2. サブクラス側のテーブル（projects, ideas）の主キーを posts.id への外部キー参照へ変更します。（必要に応じて一時テーブルを用いて既存データを保護します）。

### フェーズ 2: データのバックフィル (SQLスクリプト)
新しい構造に既存のデータを流し込むためのスクリプトを実行します。
```sql
-- 1. projects から posts へバックフィル
INSERT INTO posts (id, author_id, type, created_at, updated_at)
SELECT id, author_id, 'project', created_at, updated_at FROM projects;

-- 2. ideas から posts へバックフィル
INSERT INTO posts (id, author_id, type, created_at, updated_at)
SELECT id, author_id, 'idea', created_at, updated_at FROM ideas;

-- 3. project_comments から新 comments へバックフィル
INSERT INTO comments (id, post_id, parent_id, author_id, content, content_format, created_at, updated_at)
SELECT id, project_id, parent_id, author_id, content, content_format, created_at, updated_at FROM project_comments;

-- 4. idea_comments から新 comments へバックフィル
INSERT INTO comments (id, post_id, parent_id, author_id, content, content_format, created_at, updated_at)
SELECT id, idea_id, parent_id, author_id, content, content_format, created_at, updated_at FROM idea_comments;
```

### フェーズ 3: コードの切り替えと旧テーブルの削除
1. すべてのバックエンドのエンドポイント、クエリ、Server Actions の参照先を、基底の posts と新 comments を通した読み書きへと切り替えます。
2. システムビルドと実行時の整合性に問題がないことを確認（検証）します。
3. 非推奨となった古いテーブル project_comments, idea_comments, idea_likes を削除（Drop）します。
