import { container, DependencyContainer } from "tsyringe";

import { CleanupScheduler } from "./cleanupScheduler";

export class CleanupSchedulerFactory {
    public constructor(private readonly depContainer: DependencyContainer) {}

    public create(): CleanupScheduler {
        return this.depContainer.resolve(CleanupScheduler);
    }
}

container.register(CleanupSchedulerFactory, { useFactory: (c) => new CleanupSchedulerFactory(c) });
