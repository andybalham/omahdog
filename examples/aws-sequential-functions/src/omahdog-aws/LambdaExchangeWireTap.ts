import { SNSEvent } from 'aws-lambda';
import { FlowRequestMessage, FlowResponseMessage } from './FlowMessage';

export class LambdaExchangeWireTap {
    async handle(event: SNSEvent): Promise<void> {
        try {
        
            const snsMessage = event.Records[0].Sns;
    
            const message: FlowRequestMessage | FlowResponseMessage = JSON.parse(snsMessage.Message);
    
            if ('request' in message) {
    
                const logEntry = {
                    MessageAttributes: snsMessage.MessageAttributes,
                    RequestContext: message.requestContext,
                    ResponseContext: message.responseContext,
                    Request: message.request
                };
        
                console.log(JSON.stringify(logEntry));
        
            } else if ('response' in message) {
    
                const logEntry = {
                    MessageAttributes: snsMessage.MessageAttributes,
                    ResponseContext: message.responseContext,
                    Response: message.response
                };
        
                console.log(JSON.stringify(logEntry));
    
            } else {
    
                console.error(JSON.stringify(snsMessage));
    
            }
    
        } catch (error) {
            console.error(`error.message: ${error.message}`);        
            console.error(`error.stack: ${error.stack}`);        
        }    
    } 
}
