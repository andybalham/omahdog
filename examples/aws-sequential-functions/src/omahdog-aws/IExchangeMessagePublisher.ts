import { ExchangeResponseMessage, ExchangeRequestMessage, ExchangeCallingContext } from './Exchange';
import { FlowContext } from '../omahdog/FlowContext';

export interface IExchangeMessagePublisher {
    publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void>;
    publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void>;
}