import uuid = require('uuid');
import { FlowMocks } from './FlowMocks';
import { ErrorResponse } from './FlowExchanges';

export class FlowContext {

    requestRouter: RequestRouter;
    handlerFactory: HandlerFactory;

    readonly correlationId: string;
    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];

    readonly resumeStackFrames?: FlowInstanceStackFrame[];
    readonly initialResumeStackFrameCount?: number;
    asyncResponse: any;
    
    readonly mocks: FlowMocks;

    static newContext(): FlowContext {
        return new FlowContext();
    }

    static newCorrelatedContext(flowCorrelationId: string): FlowContext {
        return new FlowContext(flowCorrelationId);
    }

    // TODO 01May20: Could we pass in a 'error response' here?
    static newResumeContext(flowInstance: FlowInstance, asyncResponse: any): FlowContext {
        return new FlowContext(flowInstance.correlationId, flowInstance.instanceId, flowInstance.stackFrames, asyncResponse);
    }

    private constructor(flowCorrelationId?: string, instanceId?: string, stackFrames?: FlowInstanceStackFrame[], asyncResponse?: any) {

        this.requestRouter = new RequestRouter();
        this.handlerFactory = new HandlerFactory();
        this.mocks = new FlowMocks();

        this.correlationId = flowCorrelationId ?? uuid.v4();
        this.instanceId = instanceId ?? uuid.v4();

        this.stackFrames = [];

        if (asyncResponse !== undefined) {

            this.resumeStackFrames = stackFrames?.reverse();
            this.asyncResponse = asyncResponse;
            
            this.initialResumeStackFrameCount = this.resumeStackFrames?.length;

        }
    }

    get rootStackFrame(): FlowInstanceStackFrame {
        return this.stackFrames[0];
    }

    get currentStackFrame(): FlowInstanceStackFrame {
        return this.stackFrames[this.stackFrames.length - 1];
    }

    get isResume(): boolean {
        return this.asyncResponse !== undefined;
    }

    async sendRequest<TReq, TRes>(RequestType: new () => TReq, request: TReq): Promise<TRes> {

        const handlerType = this.requestRouter.getHandlerType(RequestType);

        if (handlerType === undefined) throw new Error('handlerType === undefined');

        const handler = this.handlerFactory.newHandler(handlerType);

        const response = await handler.handle(this, request);

        return response;
    }

    getMockResponse(stepName: any, request: any): any {

        const isRootFlow = this.stackFrames.length === 1;

        if (!isRootFlow) {            
            return undefined;
        }

        const mockResponse = this.mocks.getResponse(stepName, request);
        
        return mockResponse;
    }

    getAsyncResponse(requestId: string): AsyncResponse {
        return new AsyncResponse(this.correlationId, this.instanceId, this.stackFrames, requestId);
    }
}

export class FlowInstance {
    
    readonly correlationId: string;
    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];

    constructor(correlationId: string, instanceId: string, stackFrames: FlowInstanceStackFrame[]) {
        this.correlationId = correlationId;
        this.instanceId = instanceId;
        this.stackFrames = stackFrames;
    }
}

export class FlowInstanceStackFrame {

    readonly flowTypeName: string;
    readonly state: any;
    stepName?: string;

    constructor(flowTypeName: string, state: any) {
        this.flowTypeName = flowTypeName;
        this.state = state;
    }
}

export interface IActivityRequestHandlerBase {
    handle(flowContext: FlowContext, request?: any): Promise<any | AsyncResponse>;
}


export interface IActivityRequestHandler<TReq, TRes> extends IActivityRequestHandlerBase {
    handle(flowContext: FlowContext, request?: TReq): Promise<TRes | AsyncResponse | ErrorResponse>;
}

export class AsyncResponse {
    
    readonly AsyncResponse: boolean = true;

    readonly correlationId: string;
    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];
    readonly requestId: string;

    constructor(correlationId: string, instanceId: string, stackFrames: FlowInstanceStackFrame[], requestId: string) {
        this.correlationId = correlationId;
        this.instanceId = instanceId;
        this.stackFrames = stackFrames;
        this.requestId = requestId;
    }

    getFlowInstance(): FlowInstance {
        return new FlowInstance(this.correlationId, this.instanceId, this.stackFrames);
    }
}

export class HandlerFactory {

    private readonly _handlerInstantiators = new Map<string, () => IActivityRequestHandlerBase>();

    register<T extends IActivityRequestHandlerBase>(HandlerType: new () => T, handlerInstantiator: () => T): HandlerFactory {

        this._handlerInstantiators.set(HandlerType.name, handlerInstantiator);
        return this;
    }    

    newHandler<T extends IActivityRequestHandlerBase>(HandlerType: new () => T): IActivityRequestHandlerBase {

        const instantiator = this._handlerInstantiators.get(HandlerType.name);

        if (instantiator === undefined) throw new Error(`No handler registered for: ${HandlerType.name}`);

        // TODO 25Apr20: Should we instantiate the handler each time? The instantiation should be lightweight
        const handler = instantiator();
        return handler;
    }
}

export class RequestRouter {

    private readonly _requestHandlerTypes = new Map<string, new () => IActivityRequestHandlerBase>();

    register<TReq, TRes, THand extends IActivityRequestHandler<TReq, TRes>>(
        RequestType: new () => TReq, _ResponseType: new () => TRes, HandlerType: new () => THand): RequestRouter {

        this._requestHandlerTypes.set(RequestType.name, HandlerType);
        return this;
    }
    
    getHandlerType<TReq>(RequestType: new () => TReq): new () => IActivityRequestHandlerBase {

        const handlerType = this._requestHandlerTypes.get(RequestType.name);

        if (handlerType === undefined) throw new Error(`No handlerType defined for: ${RequestType.name}`);

        return handlerType;
    }
}
