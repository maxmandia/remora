export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};
