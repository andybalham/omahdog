import { FlowInstance, FlowRequestContext } from '../omahdog/FlowContext';
import { FlowResponseContext } from './FlowMessage';

// TODO 29Jun20: Change this to be FlowInstance

export interface IFunctionInstanceRepository {    
    store(instance: FunctionInstance): Promise<void>;    
    retrieve(instanceId: string): Promise<FunctionInstance | undefined>;    
    delete(instanceId: string): Promise<void>;
}

export class FunctionInstance {
    readonly flowResponseContext?: FlowResponseContext;
    readonly flowInstance: FlowInstance;
    readonly flowRequestId: string;
    readonly resumeCount: number;
}

