import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    email: string;
    is_admin?: boolean;
  }

  interface Session {
    user: User & {
      id: string;
      username: string;
      is_admin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    is_admin: boolean;
  }
}
