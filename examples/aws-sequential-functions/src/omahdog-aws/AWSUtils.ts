import { SNSEvent, APIGatewayEvent, SNSMessage } from 'aws-lambda';
import { SNSFlowMessage } from '../omahdog-aws';
import { HttpResponse } from 'aws-sdk';

export function getEventRequest<T>(event: T | SNSEvent | APIGatewayEvent): T {

    let request;

    if ('Records' in event) {

        const snsMessage = event.Records[0].Sns;
        // TODO 14Apr20: Check snsMessage.MessageAttributes to see if this is a resume
        const snsFlowMessage = JSON.parse(snsMessage.Message) as SNSFlowMessage;    
        request = snsFlowMessage.body;

    } else if ('httpMethod' in event) {

        if (event.body === null) throw new Error('APIGatewayEvent.body was null');
        request = JSON.parse(event.body);

    } else {

        request = event;

    }

    return request;
}


export function getReturnValue<TReq, Tres>(event: TReq | SNSEvent | APIGatewayEvent, httpStatusCode: number, response: Tres | undefined): Tres | void | HttpResponse {

    let returnValue: Tres | void | HttpResponse;

    if ('Records' in event) {
        returnValue = undefined;
    }
    else if ('httpMethod' in event) {
        const httpResponse = new HttpResponse();
        httpResponse.statusCode = httpStatusCode;
        httpResponse.body = JSON.stringify(response);
        returnValue = httpResponse;
    }
    else {
        returnValue = response;
    }

    return returnValue;
}

export function isSNSRequest(snsMessage: SNSMessage): boolean {
    const isSNSRequest = snsMessage.MessageAttributes['MessageType'].Value.endsWith(':Request');
    return isSNSRequest;
}

