import { FlowInstance } from '../omahdog/FlowContext';
import { ExchangeCallingContext } from './Exchange';
import { IService } from './IService';

export class FunctionInstanceRepository implements IService {

    async store(instance: FunctionInstance): Promise<void> {}
    
    async retrieve(instanceId: string): Promise<FunctionInstance | undefined> { return undefined; }
    
    async delete(instanceId: string): Promise<void> {}

    validate(): string[] {
        return ['null'];
    }

    throwErrorIfInvalid(): void {
        const errorMessages = this.validate();
        if (errorMessages.length > 0) {
            throw new Error(`${FunctionInstanceRepository.name} is not valid:\n${errorMessages.join('\n')}`);
        }
    }
}

export class FunctionInstance {
    readonly callingContext: ExchangeCallingContext;
    readonly flowInstance: FlowInstance;
    readonly requestId: string;
    readonly resumeCount: number;
}

