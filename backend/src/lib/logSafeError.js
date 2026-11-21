function logSafeError(context, error) {
    const name = error && typeof error.name === "string" &&
        /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)
        ? error.name
        : "Error";

    const code = error && typeof error.code === "string" &&
        /^[A-Za-z0-9_]{1,32}$/.test(error.code)
        ? error.code
        : undefined;

    if (code === "P2022") {
        const meta = error.meta || {};

        const modelName =
            typeof meta.modelName === "string"
                ? meta.modelName
                : undefined;

        const column =
            meta.driverAdapterError?.cause?.column ??
            meta.column;

        console.error(context, {
            name,
            code,
            ...(modelName ? { modelName } : {}),
            ...(typeof column === "string" ? { column } : {})
        });
        return;
    }

    console.error(context, code ? { name, code } : { name });
}

module.exports = logSafeError;
