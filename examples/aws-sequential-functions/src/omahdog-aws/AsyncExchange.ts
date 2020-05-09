// TODO 06May20: Think about renaming these, e.g. AsyncCallingContext -> ExchangeMessageContext, AsyncRequestMessage -> ExchangeRequestMessage

export class AsyncCallingContext {
    readonly requestId: string;
    readonly handlerTypeName: string;
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