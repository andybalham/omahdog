import { SNSEvent } from 'aws-lambda';
import { FlowRequestMessage, FlowResponseMessage } from './FlowMessage';
import { ErrorResponse } from '../omahdog/FlowExchanges';
import { IResponseMessagePublisher } from './IResponseMessagePublisher';

export class DeadLetterQueueHandler {
    
    private readonly _responseMessagePublisher: IResponseMessagePublisher;

    constructor (responseMessagePublisher: IResponseMessagePublisher) {
        this._responseMessagePublisher = responseMessagePublisher;
    }

    async handle(event: SNSEvent): Promise<void> {

        try {

            const snsMessage = event.Records[0].Sns;
    
            console.log(JSON.stringify(snsMessage));
        
            const deadEvent: SNSEvent = JSON.parse(snsMessage.Message);
    
            const deadSnsMessage = deadEvent.Records[0].Sns;
    
            const deadMessage: FlowRequestMessage | FlowResponseMessage = JSON.parse(deadSnsMessage.Message);
    
            if ('request' in deadMessage) {
    
                const logEntry = {
                    MessageAttributes: deadSnsMessage.MessageAttributes,
                    CallContext: deadMessage.callContext,
                    RequesterId: deadMessage.callbackId,
                    RequestId: deadMessage.requestId,
                    Request: deadMessage.request
                };
        
                console.log(JSON.stringify(logEntry));
    
                if (deadMessage.callbackId !== undefined) {
                    
                    const response: ErrorResponse = {
                        ErrorResponse: true,
                        name: 'Error',
                        message: snsMessage.MessageAttributes.ErrorMessage.Value
                    };
        
                    const responseMessage: FlowResponseMessage = 
                        {
                            requestId: deadMessage.requestId,
                            response: response
                        };
            
                    await this._responseMessagePublisher.publishResponse(deadMessage.callbackId, responseMessage);
                }
        
            } else if ('response' in deadMessage) {
    
                // TODO 03May20: Do something more with the dead response

                const logEntry = {
                    MessageAttributes: deadSnsMessage.MessageAttributes,
                    RequestId: deadMessage.requestId,
                    Response: deadMessage.response
                };
        
                console.log(JSON.stringify(logEntry));
    
            } else {
    
                console.error(JSON.stringify(deadSnsMessage));
    
            }
            
        } catch (error) {
            console.error(`error.message: ${error.message}`);        
            console.error(`error.stack: ${error.stack}`);        
        }
    }
}
