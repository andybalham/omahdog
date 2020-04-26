import { FlowInstance } from '../omahdog/FlowContext';
import { AsyncCallingContext } from './AsyncExchange';

export interface IFunctionInstanceRepository {

    store(instance: FunctionInstance): Promise<void>;
    
    retrieve(instanceId: string): Promise<FunctionInstance | undefined>;
    
    delete(instanceId: string): Promise<void>;
}

export class FunctionInstance {
    readonly callingContext: AsyncCallingContext;
    readonly flowInstance: FlowInstance;
    readonly requestId: string;
    readonly resumeCount: number;
}

