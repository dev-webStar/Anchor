import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// Server functions only accept same-origin requests (sign-in uses a cookie session).
const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf],
}));
