import { FlowResponseMessage, FlowRequestMessage } from './FlowMessage';

export interface IExchangeMessagePublisher {
    publishRequest(requestTypeName: string, message: FlowRequestMessage): Promise<void>;
    publishResponse(requesterId: string, message: FlowResponseMessage): Promise<void>;
}
