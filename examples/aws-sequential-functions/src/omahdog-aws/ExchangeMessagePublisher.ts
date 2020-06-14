import { ExchangeResponseMessage, ExchangeRequestMessage } from './Exchange';

export interface IExchangeMessagePublisher {
    publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void>;
    publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void>;
}
