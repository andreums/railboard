import basicAuth from "express-basic-auth";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "railboard";

export const adminAuth = basicAuth({
  users: { admin: ADMIN_PASSWORD },
  challenge: true,
  realm: "Railboard Admin",
});
