import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    tenantId?: string;
    businessId?: string;
  }

  interface User {
    id: string;
    tenantId?: string;
    businessId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    tenantId?: string;
    businessId?: string;
  }
}
