import { FlowResponseMessage, FlowRequestMessage } from './FlowMessage';

export interface IResponseMessagePublisher {
    publishResponse(callbackId: string, message: FlowResponseMessage): Promise<void>;
}
