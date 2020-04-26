// fixme: store actual calls and let the caller retrieve them?

export interface Expectation {
    stack: string;
    spy?: (...args: any[]) => any;
    args?: any[];
    returns?: any;
    throws?: Error;
}

export interface DeepMockTimes {
    times: (count: number) => void;
}

export type DeepMockFunction<T extends (...args: any[]) => any> = ReturnType<T> extends Promise<infer TP>
    ? {
          andResolve: (result: TP) => DeepMockTimes; // fixme: if returntype void, no args
          andReject: (error: Error) => DeepMockTimes;
          times: (count: number) => void;
      }
    : {
          andReturn: (result: ReturnType<T>) => DeepMockTimes; // fixme: if returntype void, not available
          andThrow: (error: Error) => DeepMockTimes;
          times: (count: number) => void;
      };

export type DeepMockProperty<T> = {
    mock: (value: T) => void;
    mockAllow: () => void;
    mockAllowMethod: () => void;
    mockPath: string;
};

export type DeepMock<T> = { [TKey in keyof T]: DeepMock<T[TKey]> } &
    DeepMockProperty<T> &
    (T extends (...args: any[]) => any
        ? { spy: (fn: T) => void; expect: ((...args: Parameters<T>) => DeepMockFunction<T>) & DeepMockFunction<T> }
        : {});

export type AssimilatedMock<T> = T extends (...args: any[]) => any
    ? { spy: (fn: T) => void; expect: ((...args: Parameters<T>) => DeepMockFunction<T>) & DeepMockFunction<T> }
    : unknown;

export type AssimilatedMockMap<T> = { [TKey in keyof T]: AssimilatedMock<T[TKey]> };
