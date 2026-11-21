"use strict";

const SEARCH_WINDOW_MS = 48 * 60 * 60 * 1000;
const FORMATTERS = new Map();

function getFormatter(timeZone) {
    if (!FORMATTERS.has(timeZone)) {
        FORMATTERS.set(timeZone, new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }));
    }
    return FORMATTERS.get(timeZone);
}

function getLocalDateKey(date, formatter) {
    const parts = Object.fromEntries(
        formatter.formatToParts(date)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value])
    );
    return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`;
}

function getLocalDayStart(dateKey, formatter) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const approximateUtc = Date.UTC(year, month - 1, day);
    let low = approximateUtc - SEARCH_WINDOW_MS;
    let high = approximateUtc + SEARCH_WINDOW_MS;

    while (high - low > 1) {
        const midpoint = Math.floor((low + high) / 2);
        if (getLocalDateKey(new Date(midpoint), formatter) >= dateKey) {
            high = midpoint;
        } else {
            low = midpoint;
        }
    }

    if (getLocalDateKey(new Date(high), formatter) !== dateKey) {
        throw new RangeError(`Local date ${dateKey} does not exist in the requested time zone`);
    }
    return new Date(high);
}

function getLocalDayRange(now, timeZone = "UTC") {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
        throw new TypeError("A valid current date is required");
    }

    const formatter = getFormatter(timeZone);
    const date = getLocalDateKey(now, formatter);
    const [year, month, day] = date.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
        .toISOString()
        .slice(0, 10);

    return {
        date,
        start: getLocalDayStart(date, formatter),
        end: getLocalDayStart(nextDate, formatter)
    };
}

module.exports = { getLocalDayRange };
