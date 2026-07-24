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
    onboardingCompleted?: boolean;
  }
}
