import { Elysia } from "elysia";
import { authPlugin } from "../middleware/auth.guard";
import { activationService } from "../services/activation.runtime";
import { R } from "../utils/response";

export const web3Router = new Elysia({ prefix: "/web3" })
	.use(authPlugin)
	.guard({ auth: true }, (app) =>
		app.post("/activate", async ({ user, set }) => {
			try {
				const activation = await activationService.activateUser(user.id);
				return R.success({
					eoaAddress: activation.eoaAddress,
					accountAddress: activation.accountAddress,
					authorization: activation.authorization,
					userOp: activation.userOp,
					userOpHash: activation.userOpHash,
					receipt: activation.receipt,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Activation failed";
				set.status = 500;
				return R.error(message, 500);
			}
		}),
	);
