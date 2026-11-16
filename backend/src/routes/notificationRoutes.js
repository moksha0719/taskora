const express = require("express");
const authenticateToken = require("../middleware/authenticateToken");
const createNotificationController = require("../controllers/notificationController");

function createNotificationRouter(notificationService) {
    const router = express.Router();
    const controller = createNotificationController(notificationService);
    router.use(authenticateToken);

    router.get("/", controller.list);
    router.get("/unread-count", controller.getUnreadCount);
    router.patch("/read-all", controller.markAllRead);
    router.patch("/:id/read", controller.markRead);
    router.delete("/:id", controller.remove);

    return router;
}

module.exports = createNotificationRouter;
