// Auth.js v5 の型拡張
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?:          string;
    username?:    string | null;
    displayName?: string | null;
    avatarUrl?:   string | null;
    role?:        string;
  }

  interface Session {
    user: {
      id:          string;
      username:    string | null;
      displayName: string | null;
      avatarUrl:   string | null;
      role:        string;
      /** プレミアムが現在有効か（期限切れは false）。付与は管理画面から */
      isPremium:   boolean;
      onboardingCompleted: boolean;
      name?:       string | null;
      email?:      string | null;
      image?:      string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?:    string | null;
    displayName?: string | null;
    avatarUrl?:   string | null;
    role?:        string;
    isPremium?:   boolean;
    onboardingCompleted?: boolean;
  }
}
