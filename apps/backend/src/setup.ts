import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";

if (!Bun.env.JWT_SECRET) {
	throw new Error("JWT_SECRET is not defined");
}

export const setup = new Elysia({ name: "Setup" }).use(
	jwt({
		name: "mytoken",
		secret: Bun.env.JWT_SECRET,
		exp: "7d",
	}),
);
