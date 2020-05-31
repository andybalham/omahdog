import { ExchangeResponseMessage, ExchangeRequestMessage, ExchangeCallingContext } from './Exchange';
import { FlowContext } from '../omahdog/FlowContext';
import { IResource } from './IResource';

export interface IExchangeMessagePublisher extends IResource {
    publishRequest(requestTypeName: string, message: ExchangeRequestMessage): Promise<void>;
    publishResponse(flowTypeName: string, message: ExchangeResponseMessage): Promise<void>;
}