import { Elysia, t } from "elysia";
import { db } from "./db";
import { setup } from "./setup";

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(setup)
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
        async ({ body, set, mytoken }) => {
          const user = await db.user.findUnique({
            where: { email: body.email },
          });

          // 验证密码
          let passwordValid = false;
          if (user) {
            passwordValid = await Bun.password.verify(
              body.password,
              user.passwordHash,
            );
          }

          if (!user || !passwordValid) {
            set.status = 401;
            return { error: "Invalid email or password" };
          }
          // 登录通过签发token
          const token = await mytoken.sign({
            id: user.id,
            email: user.email,
          });
          return {
            message: "Login successful",
            code: 200,
            data: {
              id: user.id,
              email: user.email,
              token,
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
