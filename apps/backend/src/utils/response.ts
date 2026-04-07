export const R = {
	success: <T>(data: T = null as T, msg: string = "success") => ({
		code: 200,
		msg,
		data,
	}),
	error: (msg: string, code: number = 400) => ({
		code,
		msg,
		data: null,
	}),
};
