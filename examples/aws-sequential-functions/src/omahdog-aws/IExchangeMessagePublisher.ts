import { AsyncResponseMessage, AsyncRequestMessage, AsyncCallingContext } from './AsyncExchange';
import { FlowContext } from '../omahdog/FlowContext';

export interface IExchangeMessagePublisher {
    publishRequest(requestTypeName: string, message: AsyncRequestMessage): Promise<void>;
    publishResponse(flowTypeName: string, message: AsyncResponseMessage): Promise<void>;
}