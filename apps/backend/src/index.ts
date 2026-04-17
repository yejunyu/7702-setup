import { Elysia } from "elysia";
import { db } from "./db";
import { setup } from "./setup";
import { authRoute } from "./routes/auth.route";
import { authPlugin } from "./middleware/auth.guard";
import { R } from "./utils/response";
import { web3Router } from "./routes/web3.route";

const protectedApi = new Elysia({ prefix: "/api" }).use(authPlugin).guard(
	{ auth: true },
	(app) =>
		app.get("/me", async ({ user }) => {
			const fullUser = await db.user.findUnique({
				where: { id: user.id },
				select: {
					id: true,
					name: true,
					accountAddress: true,
					email: true,
					createdAt: true,
					updatedAt: true,
				},
			});
			if (!fullUser) {
				return R.error("User not found", 404);
			}
			return R.success(fullUser);
		}),
);

const app = new Elysia()
	.get("/", () => "Hello Elysia")
	.use(setup)
	// 挂载不需要token的模块
	.use(authRoute)
	// 需要认证的接口按模块挂载。
	.use(protectedApi)
	.use(web3Router)
	.listen(3000);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
