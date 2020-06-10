import { FlowInstance } from '../omahdog/FlowContext';
import { ExchangeCallingContext } from './Exchange';

export interface IFunctionInstanceRepository {    
    isNullImplementation: boolean;
    store(instance: FunctionInstance): Promise<void>;    
    retrieve(instanceId: string): Promise<FunctionInstance | undefined>;    
    delete(instanceId: string): Promise<void>;
}

export class NullFunctionInstanceRepository implements IFunctionInstanceRepository {

    isNullImplementation: boolean;

    async store(instance: FunctionInstance): Promise<void> {}    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> { return undefined; }    
    async delete(instanceId: string): Promise<void> {}

    constructor() {
        this.isNullImplementation = true;
    }

    validate(): string[] { return ['Is a null implementation']; }
}

export class FunctionInstance {
    readonly callingContext: ExchangeCallingContext;
    readonly flowInstance: FlowInstance;
    readonly requestId: string;
    readonly resumeCount: number;
}

