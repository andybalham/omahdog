// TODO 23May20: Change to FlowCallContext, FlowRequestMessage, and FlowResponseMessage

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