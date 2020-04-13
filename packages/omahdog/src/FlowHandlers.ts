import { FlowContext } from './FlowContext';

export interface IActivityRequestHandler<TReq, TRes> {
    handle(flowContext: FlowContext, request: TReq): TRes | undefined;
}

export interface IFlowHandlers {
    sendRequest<TReq, TRes>(flowContext: FlowContext, RequestType: new () => TReq, request: TReq): TRes;
}

export class FlowHandlers implements IFlowHandlers {

    private handlerMap = new Map<string, any>();

    public register<TReq, TRes, THand extends IActivityRequestHandler<TReq, TRes>>(
        RequestType: new () => TReq, _ResponseType: new () => TRes, handler: THand): FlowHandlers {

        // TODO 10Mar20: Throw error if duplicate handler

        this.handlerMap[RequestType.name] = handler;

        return this;
    }

    public sendRequest<TReq, TRes>(flowContext: FlowContext, RequestType: new () => TReq, request: TReq): TRes {

        const handler = this.handlerMap[RequestType.name];

        if (handler === undefined) {
            throw `No handler found for request: ${RequestType.name}`;
        }

        const response = handler.handle(flowContext, request);

        return response;
    }
}
