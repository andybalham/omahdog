import { ExchangeResponseMessage, ExchangeRequestMessage } from './Exchange';

export interface IExchangeMessagePublisher {
    isNullImplementation: boolean;
    publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void>;
    publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void>;
}

export class NullExchangeMessagePublisher implements IExchangeMessagePublisher {

    isNullImplementation: boolean;
    async publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void> {}
    async publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void> {}

    constructor() {
        this.isNullImplementation = true;
    }

    validate(): string[] {
        return ['Is a null implementation'];
    }
}