import { FlowInstanceStackFrame } from './FlowContext';

export interface IFlowInstanceRepository {
    create(flowInstance: FlowInstance): Promise<void>;
    retrieve(asyncRequestId: string): Promise<FlowInstance>;
    delete(asyncRequestId: string): Promise<void>;
}

export class FlowInstance {
    
    readonly asyncRequestId: string;
    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];
    readonly resumeCount: number;

    constructor(asyncRequestId: string, instanceId: string, stackFrames: FlowInstanceStackFrame[], resumeCount: number) {
        this.asyncRequestId = asyncRequestId;
        this.instanceId = instanceId;
        this.stackFrames = stackFrames;
        this.resumeCount = resumeCount;
    }
}
