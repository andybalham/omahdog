import { SNSEvent, APIGatewayEvent, SNSMessage } from 'aws-lambda';
import { SNSFlowMessage } from '../omahdog-aws';

export function getEventRequest<T>(event: SNSEvent | APIGatewayEvent): T {

    let request: T;

    if ('Records' in event) {

        const snsMessage = event.Records[0].Sns;
        // TODO 14Apr20: Check snsMessage.MessageAttributes to see if this is a resume
        const snsFlowMessage = JSON.parse(snsMessage.Message) as SNSFlowMessage;    
        request = snsFlowMessage.body as T;

    } else if ('httpMethod' in event) {

        if (event.body === null) throw new Error('APIGatewayEvent.body was null');
        request = JSON.parse(event.body);

    } else {

        throw new Error(`Unhandled event: ${JSON.stringify(event)}`);

    }

    return request;
}

export function isSNSRequest(snsMessage: SNSMessage): boolean {
    const isSNSRequest = snsMessage.MessageAttributes['MessageType'].Value.endsWith(':Request');
    return isSNSRequest;
}
