import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const profile = await prisma.profile.findFirst({
          where: {
            email: { equals: email, mode: "insensitive" },
            deletedAt: null,
            isActive: true,
          },
        });

        if (!profile || !profile.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, profile.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: profile.id,
          email: profile.email,
          name: profile.fullName,
          image: profile.avatarUrl,
        };
      },
    }),
  ],
});
