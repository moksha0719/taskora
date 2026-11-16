
require("dotenv").config();

const createApp = require("./app");
const { getJwtSecret } = require("./config/auth");
const prisma = require("./lib/prisma");
const { startBackendServer } = require("./lib/serverLifecycle");
const { createNotificationScheduler } = require("./services/notificationScheduler");

const PORT = process.env.PORT || 5000;

getJwtSecret();
const app = createApp();
const notificationScheduler = createNotificationScheduler({ prismaClient: prisma });

startBackendServer({
    app,
    port: PORT,
    prismaClient: prisma,
    notificationScheduler
});
