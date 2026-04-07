import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db } from "./db";



const app = new Elysia()
	.get("/", () => "Hello Elysia")
	.use(
		jwt({
			name: "token",
			secret: Bun.env.JWT_SECRET,
		}),
	)
	.group("/auth", (auth) =>
		auth
			.post(
				"/register",
				async ({ body, set }) => {
					const existingUser = await db.user.findUnique({
						where: { email: body.email },
					});
					if (existingUser) {
						set.status = 400;
						return { error: "Email already exists" };
					}
					const passwordHash = await Bun.password.hash(body.password);
					const user = await db.user.create({
						data: {
							name: "web3test",
							email: body.email,
							passwordHash,
						},
					});
					return {
						message: "User registered successfully",
						code: 200,
						data: {
							id: user.id,
							email: user.email,
						},
					};
				},
				{
					body: t.Object({
						email: t.String({ format: "email" }),
						password: t.String({ minLength: 6 }),
					}),
				},
			)
			.post(
				"/login",
				async ({ body, set, jwt }) => {
					const user = await db.user.findUnique({
						where: { email: body.email },
					});

					// 验证密码
					let passwordValid = false;
					if (user) {
						passwordValid = await Bun.password.verify(
							user.passwordHash,
							body.password,
						);
					}

					if (!user || !passwordValid) {
						set.status = 401;
						return { error: "Invalid email or password" };
					}
					// 登录通过签发token
					const token = jwt.sign({
						id: user.id,
						email: user.email,
						exp: "7d",
						expiresIn: "7d",
					});
					return {
						message: "Login successful",
						code: 200,
						data: {
							id: user.id,
							email: user.email,
						},
					};
				},
				{
					body: t.Object({
						email: t.String({ format: "email" }),
						password: t.String({ minLength: 6 }),
					}),
				},
			),
	)
	.listen(3000);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
