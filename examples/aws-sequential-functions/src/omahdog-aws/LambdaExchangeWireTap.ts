import { SNSEvent } from 'aws-lambda';
import { ExchangeRequestMessage, ExchangeResponseMessage } from './Exchange';

export class LambdaExchangeWireTap {
    async handle(event: SNSEvent): Promise<void> {
        try {
        
            const snsMessage = event.Records[0].Sns;
    
            const message: ExchangeRequestMessage | ExchangeResponseMessage = JSON.parse(snsMessage.Message);
    
            if ('request' in message) {
    
                const logEntry = {
                    MessageAttributes: snsMessage.MessageAttributes,
                    MessageContext: message.callingContext,
                    Request: message.request
                };
        
                console.log(JSON.stringify(logEntry));
        
            } else if ('response' in message) {
    
                const logEntry = {
                    MessageAttributes: snsMessage.MessageAttributes,
                    MessageContext: message.callingContext,
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
