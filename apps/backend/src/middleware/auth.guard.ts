import { Elysia } from "elysia";
import { setup } from "../setup";
import { R } from "../utils/response";

export const isAuth = new Elysia({ name: "Middleware.Auth" })
	.use(setup) // jwt
	.derive(async ({ mytoken, headers }) => {
		const auth = headers.authorization;
		const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
		const payload = token ? await mytoken.verify(token) : null;
		return {
			user: payload as { id: number; email: string } | null,
		};
	})
	.onBeforeHandle(({ user, set }) => {
		if (!user) {
			set.status = 401;
			return R.error("Unauthorized");
		}
	});
