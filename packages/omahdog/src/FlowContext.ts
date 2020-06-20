import uuid = require('uuid');
import { FlowMocks } from './FlowMocks';
import { ErrorResponse } from './FlowExchanges';
import { IResumableRequestHandler } from './FlowRequestHandler';

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
    
    private _rootHandlerTypeName: string;
    get rootHandlerTypeName(): string { return this._rootHandlerTypeName; }

    static newContext(requestRouter?: RequestRouter, handlerFactory?: HandlerFactory): FlowContext {
        return new FlowContext(undefined, undefined, undefined, requestRouter, handlerFactory);
    }

    static newCorrelatedContext(flowCorrelationId: string, requestRouter?: RequestRouter, handlerFactory?: HandlerFactory): FlowContext {
        return new FlowContext(flowCorrelationId, undefined, undefined, requestRouter, handlerFactory);
    }

    static newResumeContext(flowInstance: FlowInstance, requestRouter?: RequestRouter, handlerFactory?: HandlerFactory): FlowContext {
        return new FlowContext(
            flowInstance.correlationId, flowInstance.instanceId, flowInstance.stackFrames, requestRouter, handlerFactory);
    }

    private constructor(flowCorrelationId?: string, instanceId?: string, stackFrames?: FlowInstanceStackFrame[], 
        requestRouter?: RequestRouter, handlerFactory?: HandlerFactory) {

        this.requestRouter = requestRouter ?? new RequestRouter();
        this.handlerFactory = handlerFactory ?? new HandlerFactory();
        this.mocks = new FlowMocks();

        this.correlationId = flowCorrelationId ?? uuid.v4();
        this.instanceId = instanceId ?? uuid.v4();

        this.stackFrames = [];

        if (stackFrames !== undefined) {
            this.resumeStackFrames = stackFrames?.reverse();
            this.initialResumeStackFrameCount = this.resumeStackFrames?.length;
        }
    }

    get currentStackFrame(): FlowInstanceStackFrame {
        return this.stackFrames[this.stackFrames.length - 1];
    }

    get isResume(): boolean {
        return this.asyncResponse !== undefined;
    }

    async sendRequest<TReq, TRes>(requestType: new () => TReq, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse> {

        const handlerType = this.requestRouter.getHandlerType(requestType);

        if (handlerType === undefined) throw new Error('handlerType === undefined');
        
        return await this.handleRequest(handlerType, request);
    }

    async handleRequest<TReq, TRes>(handlerType: new () => IActivityRequestHandlerBase, request: TReq): 
        Promise<TRes | AsyncResponse | ErrorResponse> {

        if (this._rootHandlerTypeName === undefined) {
            this._rootHandlerTypeName = handlerType.name;
        }

        const handler = this.handlerFactory.newHandler(handlerType);

        const response = await handler.handle(this, request);

        return response;
    }

    async receiveResponse<TReq, TRes>(requestType: new () => TReq, asyncResponse: any): Promise<TRes | AsyncResponse | ErrorResponse> {
        
        const handlerType = this.requestRouter.getHandlerType(requestType);

        if (handlerType === undefined) throw new Error('handlerType === undefined');
        
        return await this.handleResponse(handlerType, asyncResponse);
    }

    async handleResponse<TReq, TRes>(handlerType: new () => IActivityRequestHandlerBase, asyncResponse: any): 
        Promise<TRes | AsyncResponse | ErrorResponse> {
        
        if (this._rootHandlerTypeName === undefined) {
            this._rootHandlerTypeName = handlerType.name;
        }

        this.asyncResponse = asyncResponse;

        const handler = 
            this.handlerFactory.newHandler(handlerType) as IActivityRequestHandlerBase | IResumableRequestHandler;

        if ('resume' in handler) {
            const response = await handler.resume(this);
            return response;
        }

        throw new Error(`${handlerType.name} does not implement IResumableRequestHandler`);
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
    handle(flowContext: FlowContext, request: any): Promise<any>;
}

export interface ICompositeRequestHandler {
    getSubRequestTypes(): (new () => any)[];
}

export interface IActivityRequestHandler<TReq, TRes> extends IActivityRequestHandlerBase {
    handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse>;
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

    private readonly initialisers = new Map<string, (handler: any) => void>();

    setInitialiser<T extends IActivityRequestHandlerBase>(handlerType: new () => T, initialiser: (handler: T) => void): HandlerFactory {

        if (this.initialisers.has(handlerType.name)) {
            throw new Error(`Initialiser already set for ${handlerType.name}`);
        }
        this.initialisers.set(handlerType.name, initialiser);
        return this;
    }    

    newHandler<T extends IActivityRequestHandlerBase>(type: new () => T): IActivityRequestHandlerBase {

        const handler = new type();

        const initialiser = this.initialisers.get(type.name);
        
        if (initialiser !== undefined) {
            initialiser(handler);
        }
        
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
