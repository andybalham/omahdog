import { FlowInstanceStackFrame } from './FlowContext';

export interface IFlowInstanceRepository {
    upsert(flowInstance: FlowInstance): Promise<void>;
    retrieve(instanceId: string): Promise<FlowInstance>;
    delete(instanceId: string): Promise<void>;
}

export class FlowInstance {
    
    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];
    readonly asyncRequestId: string;

    constructor(instanceId: string, stackFrames: FlowInstanceStackFrame[], asyncRequestId: string) {
        this.instanceId = instanceId;
        this.stackFrames = stackFrames;
        this.asyncRequestId = asyncRequestId;
    }
}
