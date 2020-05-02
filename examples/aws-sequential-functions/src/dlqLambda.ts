import { SNSEvent } from 'aws-lambda';
import { AsyncRequestMessage, AsyncResponseMessage } from './omahdog-aws/AsyncExchange';

// TODO 01May20: Package this up as a class for easy use in a host application

export const handler = async (event: SNSEvent): Promise<void> => {

    const snsMessage = event.Records[0].Sns;

    console.error(JSON.stringify(snsMessage));

    const deadMessage: AsyncRequestMessage | AsyncResponseMessage = JSON.parse(snsMessage.Message);

    if ('request' in deadMessage) {

        // TODO 01May20: We need to package this dead request as an error response to be potentially handled

        const logEntry = {
            MessageAttributes: snsMessage.MessageAttributes,
            MessageContext: deadMessage.callingContext,
            Request: deadMessage.request
        };
    
        console.log(JSON.stringify(logEntry));
    
    } if ('response' in deadMessage) {

        // TODO 01May20: We will need to abort the flow that could not process the request
        
        const logEntry = {
            MessageAttributes: snsMessage.MessageAttributes,
            MessageContext: deadMessage.callingContext,
            Response: deadMessage.response
        };
    
        console.log(JSON.stringify(logEntry));

    } else {

        console.error(JSON.stringify(snsMessage));

    }
};
