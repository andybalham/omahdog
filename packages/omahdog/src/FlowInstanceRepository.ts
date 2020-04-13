import { FlowInstanceStackFrame } from './FlowContext';

export interface IFlowInstanceRepository {
    // TODO 02Apr20: We would want to save the requestId as well
    upsert(instanceId: string, stackFrames: FlowInstanceStackFrame[]): void;
    retrieve(instanceId: string): FlowInstanceStackFrame[];
    delete(instanceId: string): void;
}
