import { FlowContext } from './FlowContext';

export interface IActivityRequestHandler<TReq, TRes> {
    handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse>;
}

export class AsyncResponse {
    readonly asyncRequestId: string;
    constructor(asyncRequestId: string) {
        this.asyncRequestId = asyncRequestId;        
    }
}

export interface IFlowHandlers {
    sendRequest<TReq, TRes>(flowContext: FlowContext, RequestType: new () => TReq, request: TReq): Promise<TRes | AsyncResponse>;
}

export class FlowHandlers implements IFlowHandlers {

    private handlerMap = new Map<string, any>();

    public register<TReq, TRes, THand extends IActivityRequestHandler<TReq, TRes>>(
        RequestType: new () => TReq, _ResponseType: new () => TRes, handler: THand): FlowHandlers {

        // TODO 10Mar20: Throw error if duplicate handler

        this.handlerMap[RequestType.name] = handler;

        return this;
    }

    public async sendRequest<TReq, TRes>(flowContext: FlowContext, RequestType: new () => TReq, request: TReq): Promise<TRes> {

        const handler = this.handlerMap[RequestType.name];

        if (handler === undefined) {
            throw `No handler found for request: ${RequestType.name}`;
        }

        const response = await handler.handle(flowContext, request);

        return response;
    }
}
