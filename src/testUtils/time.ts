interface TimeoutEntry {
    start: number;
    callback: () => void;
}

let currentTime = 0;
let timeouts: TimeoutEntry[] = [];

(window as any).setTimeout = (callback: () => void, ms: number) => {
    const entry: TimeoutEntry = {
        start: currentTime + ms,
        callback,
    };
    timeouts.push(entry);
    return entry;
};

(window as any).clearTimeout = (entry: TimeoutEntry) => {
    const index = timeouts.indexOf(entry);
    if (index >= 0) timeouts.splice(index, 1);
};

export function advanceTime(ms: number) {
    currentTime += ms;
    const remaining: TimeoutEntry[] = [];
    const expired: TimeoutEntry[] = [];
    for (const entry of timeouts) {
        if (entry.start <= currentTime) expired.push(entry);
        else remaining.push(entry);
    }
    timeouts = remaining;
    expired.sort((a, b) => a.start - b.start).forEach((e) => e.callback());
}

beforeEach(() => {
    timeouts = [];
    currentTime = 0;
});

afterEach(() => {
    // eslint-disable-next-line jest/no-standalone-expect
    expect(timeouts).toHaveLength(0);
});
