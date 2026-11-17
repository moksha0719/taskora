function startBackendServer({
    app,
    port,
    prismaClient,
    notificationScheduler,
    processTarget = process,
    logger = console
}) {
    const server = app.listen(port, () => {
        logger.log(`Taskora server running on port ${port}`);
        notificationScheduler.start();
    });
    let shutdownPromise = null;

    async function shutdown(signal) {
        if (shutdownPromise) {
            return shutdownPromise;
        }

        shutdownPromise = (async () => {
            logger.log(`Taskora server shutting down (${signal})`);
            let shutdownError = null;
            try {
                await notificationScheduler.stop();
            } catch (error) {
                shutdownError = error;
            }

            await new Promise((resolve) => {
                server.close((error) => {
                    if (error && !shutdownError) {
                        shutdownError = error;
                    }
                    resolve();
                });
            });

            try {
                await prismaClient.$disconnect();
            } catch (error) {
                if (!shutdownError) {
                    shutdownError = error;
                }
            }

            if (shutdownError) {
                throw shutdownError;
            }
        })();
        return shutdownPromise;
    }

    const handleSignal = (signal) => {
        shutdown(signal).catch((error) => {
            logger.error(
                "Graceful shutdown failed:",
                error && error.name ? error.name : "Error"
            );
            processTarget.exitCode = 1;
        });
    };

    processTarget.on("SIGINT", handleSignal);
    processTarget.on("SIGTERM", handleSignal);

    return { server, shutdown };
}

module.exports = { startBackendServer };
