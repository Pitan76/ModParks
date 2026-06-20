export interface ApiUser {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  githubUsername?: string | null;
}

export interface ApiProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  type: "mod" | "plugin";
  license: string;
  downloads: Record<string, number>;
  createdAt: number;
  updatedAt: number;
  author: ApiUser;
  tags: string[];
}

export interface ApiVersion {
  id: string;
  versionNumber: string;
  changelog: string;
  downloads: number;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  fileSha256: string | null;
  loaders: string[];
  mcVersions: string[];
  createdAt: number;
}

export interface ApiIdea {
  id: string;
  title: string;
  content: string;
  status: "open" | "in_progress" | "fulfilled";
  author: ApiUser;
  createdAt: number;
  updatedAt: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    limit: number;
    offset: number;
    count: number;
  };
}

export interface ApiDependency {
  id: string;
  dependencyType: "required" | "optional" | "incompatible" | "embedded";
  project: {
    id: string;
    slug: string;
    name: string;
    iconUrl: string | null;
  };
}

export interface ApiProjectDetail extends ApiProject {
  dependencies: ApiDependency[];
  dependents: ApiDependency[];
}
