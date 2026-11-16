const { NotificationServiceError } = require("../services/notificationService");
const {
    isValidNotificationId,
    validateNotificationListQuery
} = require("../validators/notificationValidators");

function sendNotificationError(error, res) {
    if (error instanceof NotificationServiceError) {
        if (error.code === "INVALID_INPUT") {
            return res.status(400).json({ error: error.message });
        }
        if (error.code === "NOT_FOUND") {
            return res.status(404).json({ error: error.message });
        }
    }

    return res.status(500).json({ error: "Internal server error" });
}

function createNotificationController(notificationService) {
    async function list(req, res) {
        const validation = validateNotificationListQuery(req.query);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        try {
            const result = await notificationService.listNotifications(
                req.user.id,
                validation.data
            );
            return res.json(result);
        } catch (error) {
            return sendNotificationError(error, res);
        }
    }

    async function getUnreadCount(req, res) {
        try {
            const result = await notificationService.getUnreadCount(req.user.id);
            return res.json(result);
        } catch (error) {
            return sendNotificationError(error, res);
        }
    }

    async function markRead(req, res) {
        if (!isValidNotificationId(req.params.id)) {
            return res.status(400).json({ error: "Invalid notification ID" });
        }

        try {
            const notification = await notificationService.markNotificationRead(
                req.user.id,
                req.params.id
            );
            return res.json({ notification });
        } catch (error) {
            return sendNotificationError(error, res);
        }
    }

    async function markAllRead(req, res) {
        try {
            const result = await notificationService.markAllNotificationsRead(req.user.id);
            return res.json(result);
        } catch (error) {
            return sendNotificationError(error, res);
        }
    }

    async function remove(req, res) {
        if (!isValidNotificationId(req.params.id)) {
            return res.status(400).json({ error: "Invalid notification ID" });
        }

        try {
            await notificationService.deleteNotification(req.user.id, req.params.id);
            return res.status(204).end();
        } catch (error) {
            return sendNotificationError(error, res);
        }
    }

    return { list, getUnreadCount, markRead, markAllRead, remove };
}

module.exports = createNotificationController;
