import { FlowRequestContext } from '../omahdog/FlowContext';

abstract class FlowMessage {
    responseContext?: FlowResponseContext;
}

export class FlowResponseContext {
    readonly flowHandlerTypeName: string;
    readonly flowInstanceId: string;
    readonly flowRequestId: string;
}

export class FlowRequestMessage extends FlowMessage {
    requestContext: FlowRequestContext;
    request: any;
}

export class FlowResponseMessage extends FlowMessage {
    response: any;
}
