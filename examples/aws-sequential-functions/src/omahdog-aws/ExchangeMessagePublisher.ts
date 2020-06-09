import { ExchangeResponseMessage, ExchangeRequestMessage } from './Exchange';
import { IService } from './IService';

export class ExchangeMessagePublisher implements IService {

    async publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void> {}
    async publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void> {}

    validate(): string[] {
        return ['null'];
    }

    throwErrorIfInvalid(): void {
        const errorMessages = this.validate();
        if (errorMessages.length > 0) {
            throw new Error(`${ExchangeMessagePublisher.name} is not valid:\n${errorMessages.join('\n')}`);
        }
    }
}