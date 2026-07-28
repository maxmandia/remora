export const authRoles = ["admin", "user"] as const;
export type AuthRole = (typeof authRoles)[number];

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: AuthRole;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: string;
  impersonatedBy: string | null;
};

export type AuthState = {
  session: AuthSession;
  user: AuthUser;
};
