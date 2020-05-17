declare namespace jest {
    // eslint-disable-next-line @typescript-eslint/generic-type-naming
    interface Matchers<R> {
        toHaveSameMembers: (expectedArray: any[]) => void;
        toHaveSameOrderedMembers: (expectedArray: any[]) => void;
    }
    interface Each {
        boolean: (text: string, callback: (...value: boolean[]) => any) => void;
    }
}
