import { Elysia, t } from "elysia";

export const authModel = new Elysia({ name: "Model.Auth" }).model({
	"auth.dto": t.Object({
		email: t.String({ format: "email" }),
		password: t.String({ minLength: 6 }),
	}),
});
