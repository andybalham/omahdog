import uuid = require('uuid');
import { FlowHandlers, IFlowHandlers, AsyncResponse } from './FlowHandlers';
import { FlowMocks } from './FlowMocks';

export class FlowContext {

    handlers: IFlowHandlers;

    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];

    readonly resumeStackFrames?: FlowInstanceStackFrame[];
    readonly initialResumeStackFrameCount?: number;
    asyncResponse: any;
    
    readonly mocks: FlowMocks;

    constructor(flowInstance?: FlowInstance, asyncResponse?: any) {

        this.handlers = new FlowHandlers();
        this.mocks = new FlowMocks();

        this.stackFrames = [];

        if (flowInstance === undefined) {

            this.instanceId = uuid.v4();

        } else {

            this.instanceId = flowInstance.instanceId;
            this.asyncResponse = asyncResponse;
            this.resumeStackFrames = flowInstance.stackFrames?.reverse();
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
        return new AsyncResponse(this.instanceId, this.stackFrames, requestId);
    }
}

export class FlowInstance {
    
    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];

    constructor(instanceId: string, stackFrames: FlowInstanceStackFrame[]) {
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