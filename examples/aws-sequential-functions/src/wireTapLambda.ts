import { SNSEvent } from 'aws-lambda';
import { AsyncRequestMessage, AsyncResponseMessage } from './omahdog-aws/AsyncExchange';

export const handler = async (event: SNSEvent): Promise<void> => {

    const snsMessage = event.Records[0].Sns;

    const message: AsyncRequestMessage | AsyncResponseMessage = JSON.parse(snsMessage.Message);

    if ('request' in message) {

        const logEntry = {
            MessageAttributes: snsMessage.MessageAttributes,
            MessageContext: message.callingContext,
            Request: message.request
        };
    
        console.log(JSON.stringify(logEntry));
    
    } else {

        const logEntry = {
            MessageAttributes: snsMessage.MessageAttributes,
            MessageContext: message.callingContext,
            Response: message.response
        };
    
        console.log(JSON.stringify(logEntry));

    }
};
