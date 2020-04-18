import uuid = require('uuid');
import { FlowHandlers, IFlowHandlers } from './FlowHandlers';
import { IFlowInstanceRepository } from './FlowInstanceRepository';
import { FlowMocks } from './FlowMocks';

export class FlowContext {

    handlers: IFlowHandlers;

    readonly instanceRepository?: IFlowInstanceRepository;
    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];

    readonly resumeStackFrames?: FlowInstanceStackFrame[];
    readonly initialResumeStackFrameCount?: number;
    asyncResponse: any;
    
    readonly mocks: FlowMocks;

    constructor(instanceRepository?: IFlowInstanceRepository, instanceId?: string, stackFrames?: FlowInstanceStackFrame[], asyncResponse?: any) {

        // TODO 15Apr20: Is there a way of asynchronously retrieving the stack frames?
        
        this.handlers = new FlowHandlers();
        this.mocks = new FlowMocks();

        this.instanceRepository = instanceRepository;
        this.stackFrames = [];

        if (instanceId === undefined) {

            this.instanceId = uuid.v4();

        } else {

            this.instanceId = instanceId;
            this.asyncResponse = asyncResponse;
            this.resumeStackFrames = stackFrames?.reverse();
            this.initialResumeStackFrameCount = this.resumeStackFrames?.length;

        }
    }

    private getInstanceRepository(): IFlowInstanceRepository {
        if (this.instanceRepository === undefined) throw new Error('this.instanceRepository is undefined');
        return this.instanceRepository;
    }

    get currentStackFrame(): FlowInstanceStackFrame {
        return this.stackFrames[this.stackFrames.length - 1];
    }

    get isResume(): boolean {
        return this.asyncResponse !== undefined;
    }

    async saveInstance(): Promise<void> {
        await this.getInstanceRepository().upsert(this.instanceId, this.stackFrames);
    }

    async deleteInstance(): Promise<void> {
        await this.getInstanceRepository().delete(this.instanceId);
    }

    getMockResponse(stepName: any, request: any): any {

        const isRootFlow = this.stackFrames.length === 1;

        if (!isRootFlow) {            
            return undefined;
        }

        const mockResponse = this.mocks.getResponse(stepName, request);
        
        return mockResponse;
    }
}

export class FlowInstanceStackFrame {

    readonly flowName: string;
    readonly state: any;
    stepName?: string;

    constructor(flowName: string, state: any) {
        this.flowName = flowName;
        this.state = state;
    }
}