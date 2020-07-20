import uuid = require('uuid');
import { FlowMocks } from './FlowMocks';
import { ErrorResponse } from './FlowExchanges';
import { IResumableRequestHandler } from './FlowRequestHandler';
import { Type } from './Type';

// TODO 19Jul20: Should this be OmahdogContext? It is very specific
// TODO 19Jul20: This exposes more data than a request handler needs. Do they only need CallContext??
// TODO 19Jul20: Is there something between this and call context?
export class FlowContext {

    readonly callContext: CallContext;
    readonly requesterId?: string;

    readonly stackFrames: FlowStackFrame[];

    readonly resumeStackFrames?: FlowStackFrame[];
    readonly initialResumeStackFrameCount?: number;
    private _asyncResponse: any;
    get asyncResponse(): any { return this._asyncResponse; }

    readonly requestRouter: RequestRouter;
    readonly handlerFactory: HandlerFactory;
    readonly mocks: FlowMocks;

    // TODO 19Jul20: We won't need this when we subscribe using a unique function name
    private _rootHandlerTypeName: string;
    get rootHandlerTypeName(): string { return this._rootHandlerTypeName; }

    static newContext(requestRouter?: RequestRouter, handlerFactory?: HandlerFactory): FlowContext {
        return new FlowContext(undefined, undefined, undefined, requestRouter, handlerFactory);
    }

    static newRequestContext(callContext: CallContext, requesterId: string, requestRouter?: RequestRouter, handlerFactory?: HandlerFactory): FlowContext {
        return new FlowContext(callContext, requesterId, undefined, requestRouter, handlerFactory);
    }

    static newResumeContext(callContext: CallContext, requesterId: string, stackFrames?: FlowStackFrame[], requestRouter?: RequestRouter, handlerFactory?: HandlerFactory): FlowContext {
        return new FlowContext(callContext, requesterId, stackFrames, requestRouter, handlerFactory);
    }

    private constructor(callContext?: CallContext, requesterId?: string, stackFrames?: FlowStackFrame[], requestRouter?: RequestRouter, handlerFactory?: HandlerFactory) {

        this.requestRouter = requestRouter ?? new RequestRouter();
        this.handlerFactory = handlerFactory ?? new HandlerFactory();
        this.mocks = new FlowMocks();

        this.callContext = callContext ?? new CallContext;
        this.callContext.correlationId = this.callContext.correlationId ?? uuid.v4();
        this.callContext.logLevel = this.callContext.logLevel ?? LogLevel.INFO; // TODO 08Jul20: Is this a sensible default?

        this.requesterId = requesterId;

        this.stackFrames = [];

        if (stackFrames !== undefined) {
            this.resumeStackFrames = stackFrames?.reverse();
            this.initialResumeStackFrameCount = this.resumeStackFrames?.length;
        }
    }

    get currentStackFrame(): FlowStackFrame {
        return this.stackFrames[this.stackFrames.length - 1];
    }

    get isResume(): boolean {
        return this._asyncResponse !== undefined;
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

        this._asyncResponse = asyncResponse;

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
        return new AsyncResponse(this.stackFrames, requestId);
    }

    clearAsyncResponse(): void {
        delete this._asyncResponse;
    }
}

export enum LogLevel {
    ALL = 'ALL',
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    FATAL = 'FATAL',
    OFF = 'OFF',
}

// TODO 19Jul20: Should the following have a trace? If not, how can we provide tracing?

export class CallContext {
    correlationId: string;
    customValues?: any;
    logLevel?: LogLevel;
}

export class FlowStackFrame {

    readonly handlerTypeName: string;
    readonly state: any;
    stepName?: string;

    constructor(flowTypeName: string, state: any) {
        this.handlerTypeName = flowTypeName;
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

    readonly requestId: string;
    readonly stackFrames: FlowStackFrame[];

    constructor(stackFrames: FlowStackFrame[], requestId: string) {
        this.stackFrames = stackFrames;
        this.requestId = requestId;
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
