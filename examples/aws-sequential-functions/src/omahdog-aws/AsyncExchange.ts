export class AsyncCallingContext {
    readonly requestId: string;
    readonly flowTypeName: string;
    readonly flowInstanceId: string;
    readonly flowCorrelationId: string;
}

export class AsyncRequestMessage {
    readonly callingContext: AsyncCallingContext;
    readonly request: any;
}

export class AsyncResponseMessage {
    readonly callingContext: AsyncCallingContext;
    readonly response: any;
}  