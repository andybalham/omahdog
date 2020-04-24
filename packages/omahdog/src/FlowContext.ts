import uuid = require('uuid');
import { FlowHandlers, IFlowHandlers, AsyncResponse } from './FlowHandlers';
import { FlowMocks } from './FlowMocks';

export class FlowContext {

    handlers: IFlowHandlers;

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

    static newResumeContext(flowInstance: FlowInstance, asyncResponse: any): FlowContext {
        return new FlowContext(flowInstance.correlationId, flowInstance.instanceId, flowInstance.stackFrames, asyncResponse);
    }

    private constructor(flowCorrelationId?: string, instanceId?: string, stackFrames?: FlowInstanceStackFrame[], asyncResponse?: any) {

        this.handlers = new FlowHandlers();
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

    get currentStackFrame(): FlowInstanceStackFrame {
        return this.stackFrames[this.stackFrames.length - 1];
    }

    get isResume(): boolean {
        return this.asyncResponse !== undefined;
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