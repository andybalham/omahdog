import { FlowInstance } from '../omahdog/FlowContext';
import { ExchangeCallingContext } from './Exchange';

export interface IFunctionInstanceRepository {    
    store(instance: FunctionInstance): Promise<void>;    
    retrieve(instanceId: string): Promise<FunctionInstance | undefined>;    
    delete(instanceId: string): Promise<void>;
}

export class FunctionInstance {
    readonly callingContext: ExchangeCallingContext;
    readonly flowInstance: FlowInstance;
    readonly requestId: string;
    readonly resumeCount: number;
}

