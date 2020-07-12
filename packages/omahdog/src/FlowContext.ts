import uuid = require('uuid');
import { FlowMocks } from './FlowMocks';
import { ErrorResponse } from './FlowExchanges';
import { IResumableRequestHandler } from './FlowRequestHandler';
import { Type } from './Type';

export class FlowContext {

    requestRouter: RequestRouter;
    handlerFactory: HandlerFactory;

    readonly requestContext: FlowRequestContext;

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

    static newRequestContext(flowRequestContext: FlowRequestContext, requestRouter?: RequestRouter, handlerFactory?: HandlerFactory): FlowContext {
        return new FlowContext(flowRequestContext, undefined, undefined, requestRouter, handlerFactory);
    }

    static newResumeContext(flowInstance: FlowInstance, requestRouter?: RequestRouter, handlerFactory?: HandlerFactory): FlowContext {
        return new FlowContext(
            flowInstance.flowRequestContext, flowInstance.instanceId, flowInstance.stackFrames, requestRouter, handlerFactory);
    }

    private constructor(flowRequestContext?: FlowRequestContext, instanceId?: string, stackFrames?: FlowInstanceStackFrame[],
        requestRouter?: RequestRouter, handlerFactory?: HandlerFactory) {

        this.requestRouter = requestRouter ?? new RequestRouter();
        this.handlerFactory = handlerFactory ?? new HandlerFactory();
        this.mocks = new FlowMocks();

        this.requestContext = flowRequestContext ?? new FlowRequestContext;
        this.requestContext.correlationId = this.requestContext.correlationId ?? uuid.v4();
        this.requestContext.logLevel = this.requestContext.logLevel ?? FlowLogLevel.INFO; // TODO 08Jul20: Is this a sensible default?

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

    async sendRequest<TReq, TRes>(requestType: Type<TReq>, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse> {

        const handlerType = this.requestRouter.getHandlerType(requestType);

        if (handlerType === undefined) throw new Error('handlerType === undefined');

        return await this.handleRequest(handlerType, request);
    }

    async handleRequest<TReq, TRes>(handlerType: Type<IActivityRequestHandlerBase>, request: TReq):
        Promise<TRes | AsyncResponse | ErrorResponse> {

        if (this._rootHandlerTypeName === undefined) {
            this._rootHandlerTypeName = handlerType.name;
        }

        const handler = this.handlerFactory.newHandler(handlerType);

        const response = await handler.handle(this, request);

        return response;
    }

    async receiveResponse<TReq, TRes>(requestType: Type<TReq>, asyncResponse: any): Promise<TRes | AsyncResponse | ErrorResponse> {

        const handlerType = this.requestRouter.getHandlerType(requestType);

        if (handlerType === undefined) throw new Error('handlerType === undefined');

        return await this.handleResponse(handlerType, asyncResponse);
    }

    async handleResponse<TReq, TRes>(handlerType: Type<IActivityRequestHandlerBase>, asyncResponse: any):
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
        return new AsyncResponse(this.requestContext, this.instanceId, this.stackFrames, requestId);
    }
}

export enum FlowLogLevel {
    ALL = 'ALL',
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    FATAL = 'FATAL',
    OFF = 'OFF',
}

// TODO 09Jul20: Can we think of a better name for this? RequestContext? CallContext? CallLogLevel above?

export class FlowRequestContext {
    correlationId: string;
    logLevel?: FlowLogLevel;
    customValues?: any;
}

export class FlowInstance {

    readonly flowRequestContext: FlowRequestContext;

    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];

    constructor(flowRequestContext: FlowRequestContext, instanceId: string, stackFrames: FlowInstanceStackFrame[]) {
        this.flowRequestContext = flowRequestContext;
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
    getSubRequestTypes(): (Type<any>)[];
}

export interface IActivityRequestHandler<TReq, TRes> extends IActivityRequestHandlerBase {
    handle(flowContext: FlowContext, request: TReq): Promise<TRes | AsyncResponse | ErrorResponse>;
}

export function getRequestHandlers(handlerType: Type<IActivityRequestHandlerBase>,
    handlerFactory: HandlerFactory, requestRouter: RequestRouter): Map<string, IActivityRequestHandlerBase> {

    const handlers = new Map<string, IActivityRequestHandlerBase>();

    const handler = handlerFactory.newHandler(handlerType);

    handlers.set(handlerType.name, handler);

    if ('getSubRequestTypes' in handler) {

        const subRequestTypes = (handler as ICompositeRequestHandler).getSubRequestTypes();

        subRequestTypes.forEach(subRequestType => {

            const subHandlerType = requestRouter.getHandlerType(subRequestType);

            const subHandlers = getRequestHandlers(subHandlerType, handlerFactory, requestRouter);

            subHandlers.forEach((handler, typeName) => {
                handlers.set(typeName, handler);
            });
        });
    }

    return handlers;
}

export class AsyncResponse {

    readonly AsyncResponse: boolean = true;

    readonly flowRequestContext: FlowRequestContext;

    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];
    readonly requestId: string;

    constructor(flowRequestContext: FlowRequestContext, instanceId: string, stackFrames: FlowInstanceStackFrame[], requestId: string) {
        this.flowRequestContext = flowRequestContext;
        this.instanceId = instanceId;
        this.stackFrames = stackFrames;
        this.requestId = requestId;
    }

    getFlowInstance(): FlowInstance {
        return new FlowInstance(this.flowRequestContext, this.instanceId, this.stackFrames);
    }
}

export class HandlerFactory {

    private readonly initialisers = new Map<string, (handler: any) => void>();

    setInitialiser<T extends IActivityRequestHandlerBase>(handlerType: Type<T>, initialiser: (handler: T) => void): HandlerFactory {

        if (this.initialisers.has(handlerType.name)) {
            throw new Error(`Initialiser already set for ${handlerType.name}`);
        }
        this.initialisers.set(handlerType.name, initialiser);
        return this;
    }

    newHandler<T extends IActivityRequestHandlerBase>(type: Type<T>): IActivityRequestHandlerBase {

        const handler = new type();

        const initialiser = this.initialisers.get(type.name);

        if (initialiser !== undefined) {
            initialiser(handler);
        }

        return handler;
    }
}

export class RequestRouter {

    private readonly _requestHandlerTypes = new Map<string, Type<IActivityRequestHandlerBase>>();

    register<TReq, TRes, THand extends IActivityRequestHandler<TReq, TRes>>(
        RequestType: Type<TReq>, _ResponseType: Type<TRes>, HandlerType: Type<THand>): RequestRouter {

        this._requestHandlerTypes.set(RequestType.name, HandlerType);
        return this;
    }

    getHandlerType<TReq>(RequestType: Type<TReq>): Type<IActivityRequestHandlerBase> {

        const handlerType = this._requestHandlerTypes.get(RequestType.name);

        if (handlerType === undefined) throw new Error(`No handlerType defined for: ${RequestType.name}`);

        return handlerType;
    }
}
