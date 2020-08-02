import { FlowStackFrame, CallContext } from '../omahdog/FlowContext';

// TODO 19Jul20: FunctionInstance is not quite the right terminology here

export interface IFunctionInstanceRepository {    
    store(requestId: string, instance: FunctionInstance): Promise<void>;    
    retrieve(requestId: string): Promise<FunctionInstance | undefined>;    
}

export class FunctionInstance {
    readonly callContext: CallContext;
    readonly callbackId: string;
    readonly requestId: string;
    readonly stackFrames: FlowStackFrame[];
    readonly resumeCount: number;
}