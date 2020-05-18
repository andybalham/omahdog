export class ExchangeCallingContext {
    readonly requestId: string;
    readonly handlerTypeName: string;
    readonly flowInstanceId: string;
    readonly flowCorrelationId: string;
}

export class ExchangeRequestMessage {
    readonly callingContext: ExchangeCallingContext;
    readonly request: any;
}

export class ExchangeResponseMessage {
    readonly callingContext: ExchangeCallingContext;
    readonly response: any;
}  