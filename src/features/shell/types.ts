export type ShellUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type ShellOrg = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
};

export type ShellContext = {
  user: ShellUser;
  org: ShellOrg;
  orgs: ShellOrg[];
  roleName: string;
  isGuest: boolean;
  /** Organization-scoped permission keys, plain strings so they cross the
   *  server → client boundary. */
  permissions: string[];
};
