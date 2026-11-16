const express = require("express");
const authenticateToken = require("../middleware/authenticateToken");
const createStudyPlanController = require("../controllers/studyPlanController");

function createStudyPlanRouter(studyPlanService, studyScheduleService, scheduleCompletionService) {
    const router = express.Router();
    const controller = createStudyPlanController(
        studyPlanService,
        studyScheduleService,
        scheduleCompletionService
    );
    router.use(authenticateToken);

    router.post("/", controller.create);
    router.post("/generate", controller.generateSchedulePreview);
    router.put(
        "/:planId/schedule-items/:itemId/completions/:date",
        controller.upsertScheduleCompletion
    );
    router.delete(
        "/:planId/schedule-items/:itemId/completions/:date",
        controller.deleteScheduleCompletion
    );
    router.get("/", controller.list);
    router.get("/active", controller.getActive);
    router.get("/:id", controller.getById);
    router.put("/:id/schedule", controller.saveSchedule);
    router.put("/:id", controller.update);
    router.delete("/:id", controller.remove);

    return router;
}

module.exports = createStudyPlanRouter;
