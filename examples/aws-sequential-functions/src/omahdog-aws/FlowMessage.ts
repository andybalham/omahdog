import { CallContext } from '../omahdog/FlowContext';

export class FlowRequestMessage {
    readonly callContext: CallContext;
    readonly requesterId?: string;
    readonly requestId: string;
    readonly request: any;
}

export class FlowResponseMessage {
    readonly requestId: string;
    readonly response: any;
}
