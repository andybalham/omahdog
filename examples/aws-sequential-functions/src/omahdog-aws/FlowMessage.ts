import { CallContext } from '../omahdog/FlowContext';

export class FlowRequestMessage {
    readonly callContext: CallContext;
    readonly callbackId?: string;
    readonly requestId: string;
    readonly request: any;
}

export function isAsyncFlowRequestMessage(message: FlowRequestMessage): boolean {
    return message.callbackId !== undefined;
}

export class FlowResponseMessage {
    readonly requestId: string;
    readonly response: any;
}
