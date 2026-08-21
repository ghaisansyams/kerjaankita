import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    newUser: "/register",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isPublic = [
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/auth",
        "/invite",
        "/api/auth",
      ].some((r) => pathname === r || pathname.startsWith(`${r}/`));

      if (!isLoggedIn && !isPublic) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
  providers: [],
};
